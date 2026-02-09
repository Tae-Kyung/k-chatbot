import type { SupportedLanguage } from '@/types';
import { searchDocuments } from '@/lib/rag/search';
import { buildSystemPrompt, assessConfidence } from '@/lib/rag/prompts';
import { getOpenAI } from '@/lib/openai/client';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { deduplicateSources } from '@/lib/chat/sources';
import { buildChatMessages } from '@/lib/chat/history';
import { LOCALE_CODES, LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS_CHAT } from '@/config/constants';
import { v4 as uuidv4 } from 'uuid';
import type { BotConfig, TelegramMessage } from './types';
import { sendMessage, sendChatAction } from './api';

const SUPPORTED_LANGUAGES: SupportedLanguage[] = [...LOCALE_CODES];

const FALLBACK_MESSAGES: Record<SupportedLanguage, string> = {
  ko: '죄송합니다. 해당 질문에 대한 정확한 정보를 찾지 못했습니다. 국제교류팀에 직접 문의해 주시면 더 정확한 답변을 받으실 수 있습니다.',
  en: 'Sorry, I could not find accurate information for your question. Please contact the International Office directly for a more precise answer.',
  zh: '抱歉，未能找到准确信息。请直接联系国际交流处获取更准确的回答。',
  vi: 'Xin lỗi, tôi không tìm thấy thông tin chính xác. Vui lòng liên hệ trực tiếp Phòng Hợp tác Quốc tế để được giải đáp chính xác hơn.',
  mn: 'Уучлаарай, таны асуултад тохирох мэдээлэл олдсонгүй. Олон улсын харилцааны алба руу шууд хандана уу.',
  km: 'សូមអភ័យទោស ខ្ញុំរកព័ត៌មានត្រឹមត្រូវមិនឃើញទេ។ សូមទាក់ទងការិយាល័យអន្តរជាតិដោយផ្ទាល់។',
};

interface ChatMapping {
  conversationId: string;
  language: SupportedLanguage;
}

async function getOrCreateChatMapping(
  chatId: number,
  botConfig: BotConfig
): Promise<ChatMapping> {
  const supabase = createServiceRoleClient();

  const { data: existing } = await supabase
    .from('telegram_chat_mappings')
    .select('conversation_id, language')
    .eq('telegram_chat_id', chatId)
    .eq('bot_id', botConfig.botId)
    .single();

  if (existing) {
    return {
      conversationId: existing.conversation_id,
      language: existing.language as SupportedLanguage,
    };
  }

  // Create new conversation
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert({ university_id: botConfig.universityId, language: 'ko' })
    .select('id')
    .single();

  if (convError || !conv) {
    throw new Error(`Failed to create conversation: ${convError?.message || 'no data'}`);
  }

  await supabase.from('telegram_chat_mappings').insert({
    telegram_chat_id: chatId,
    bot_id: botConfig.botId,
    university_id: botConfig.universityId,
    conversation_id: conv.id,
    language: 'ko',
  });

  return { conversationId: conv.id, language: 'ko' };
}

async function resetConversation(
  chatId: number,
  botConfig: BotConfig
): Promise<string> {
  const supabase = createServiceRoleClient();

  // Create new conversation
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert({ university_id: botConfig.universityId, language: 'ko' })
    .select('id')
    .single();

  if (convError || !conv) {
    throw new Error(`Failed to create conversation: ${convError?.message || 'no data'}`);
  }

  const conversationId = conv.id;

  // Update mapping to point to new conversation
  await supabase
    .from('telegram_chat_mappings')
    .update({
      conversation_id: conversationId,
      updated_at: new Date().toISOString(),
    })
    .eq('telegram_chat_id', chatId)
    .eq('bot_id', botConfig.botId);

  return conversationId;
}

async function setLanguage(
  chatId: number,
  botConfig: BotConfig,
  language: SupportedLanguage
): Promise<void> {
  const supabase = createServiceRoleClient();

  // Ensure mapping exists
  await getOrCreateChatMapping(chatId, botConfig);

  await supabase
    .from('telegram_chat_mappings')
    .update({
      language,
      updated_at: new Date().toISOString(),
    })
    .eq('telegram_chat_id', chatId)
    .eq('bot_id', botConfig.botId);
}

const WELCOME_MESSAGES: Record<SupportedLanguage, (uniName: string) => string> = {
  ko: (uni) => `안녕하세요! ${uni} 외국인 유학생 AI 상담 봇입니다.\n\n질문을 입력하시면 답변해 드리겠습니다.\n\n명령어:\n/help - 도움말\n/lang ko - 언어 변경\n/new - 새 대화 시작`,
  en: (uni) => `Hello! I'm the ${uni} International Student AI Counselor Bot.\n\nPlease type your question and I'll help you.\n\nCommands:\n/help - Help\n/lang en - Change language\n/new - Start new conversation`,
  zh: (uni) => `你好！我是${uni}外国留学生AI咨询机器人。\n\n请输入您的问题。\n\n命令：\n/help - 帮助\n/lang zh - 更改语言\n/new - 开始新对话`,
  vi: (uni) => `Xin chào! Tôi là Bot Tư vấn AI cho Sinh viên Quốc tế ${uni}.\n\nHãy nhập câu hỏi của bạn.\n\nLệnh:\n/help - Trợ giúp\n/lang vi - Đổi ngôn ngữ\n/new - Bắt đầu cuộc trò chuyện mới`,
  mn: (uni) => `Сайн байна уу! Би ${uni}-ийн гадаад оюутны AI зөвлөх бот.\n\nАсуултаа бичнэ үү.\n\nКоманд:\n/help - Тусламж\n/lang mn - Хэл солих\n/new - Шинэ яриа эхлэх`,
  km: (uni) => `សួស្តី! ខ្ញុំជា Bot ទីប្រឹក្សា AI សម្រាប់និស្សិតអន្តរជាតិ ${uni}។\n\nសូមវាយសំណួររបស់អ្នក។\n\nពាក្យបញ្ជា:\n/help - ជំនួយ\n/lang km - ផ្លាស់ប្តូរភាសា\n/new - ចាប់ផ្តើមការសន្ទនាថ្មី`,
};

export async function handleCommand(
  command: string,
  args: string,
  message: TelegramMessage,
  botConfig: BotConfig
): Promise<string> {
  const supabase = createServiceRoleClient();

  // Get university name
  const { data: university } = await supabase
    .from('universities')
    .select('name, name_en')
    .eq('id', botConfig.universityId)
    .single();

  const uniName = university?.name || university?.name_en || 'University';

  switch (command) {
    case '/start': {
      await getOrCreateChatMapping(message.chat.id, botConfig);
      const mapping = await getOrCreateChatMapping(message.chat.id, botConfig);
      return WELCOME_MESSAGES[mapping.language](uniName);
    }

    case '/help': {
      const mapping = await getOrCreateChatMapping(message.chat.id, botConfig);
      return WELCOME_MESSAGES[mapping.language](uniName);
    }

    case '/lang': {
      const lang = args.trim().toLowerCase();
      if (!lang) {
        return 'Usage: /lang [ko|en|zh|vi|mn|km]\n\nko=한국어, en=English, zh=中文, vi=Tiếng Việt, mn=Монгол, km=ខ្មែរ';
      }
      if (!SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)) {
        return `Unsupported language: ${lang}\nSupported: ko, en, zh, vi, mn, km`;
      }
      await setLanguage(message.chat.id, botConfig, lang as SupportedLanguage);
      const confirmMessages: Record<SupportedLanguage, string> = {
        ko: '언어가 한국어로 설정되었습니다.',
        en: 'Language set to English.',
        zh: '语言已设置为中文。',
        vi: 'Ngôn ngữ đã được đặt thành Tiếng Việt.',
        mn: 'Хэлийг Монгол болгож тохируулсан.',
        km: 'ភាសាត្រូវបានកំណត់ជាខ្មែរ។',
      };
      return confirmMessages[lang as SupportedLanguage];
    }

    case '/new': {
      await resetConversation(message.chat.id, botConfig);
      const mapping = await getOrCreateChatMapping(message.chat.id, botConfig);
      const newConvMessages: Record<SupportedLanguage, string> = {
        ko: '새 대화가 시작되었습니다. 질문을 입력해 주세요.',
        en: 'New conversation started. Please type your question.',
        zh: '已开始新对话。请输入您的问题。',
        vi: 'Đã bắt đầu cuộc trò chuyện mới. Hãy nhập câu hỏi.',
        mn: 'Шинэ яриа эхэлсэн. Асуултаа бичнэ үү.',
        km: 'ការសន្ទនាថ្មីបានចាប់ផ្តើម។ សូមវាយសំណួររបស់អ្នក។',
      };
      return newConvMessages[mapping.language];
    }

    default:
      return 'Unknown command. Type /help for available commands.';
  }
}

export async function handleTelegramMessage(
  message: TelegramMessage,
  botConfig: BotConfig
): Promise<void> {
  const chatId = message.chat.id;
  const text = message.text?.trim();

  if (!text) return;

  // Send typing indicator
  await sendChatAction(botConfig.token, chatId);

  // Check for bot commands
  if (text.startsWith('/')) {
    const spaceIdx = text.indexOf(' ');
    const command = spaceIdx === -1 ? text : text.slice(0, spaceIdx);
    const args = spaceIdx === -1 ? '' : text.slice(spaceIdx + 1);
    const response = await handleCommand(command, args, message, botConfig);
    await sendMessage(botConfig.token, chatId, response);
    return;
  }

  // Get or create chat mapping
  const mapping = await getOrCreateChatMapping(chatId, botConfig);
  const { conversationId, language } = mapping;

  const supabase = createServiceRoleClient();

  // Save user message
  const userMsgId = uuidv4();
  await supabase.from('messages').insert({
    id: userMsgId,
    conversation_id: conversationId,
    role: 'user',
    content: text,
  });

  // Get university info
  const { data: university } = await supabase
    .from('universities')
    .select('name')
    .eq('id', botConfig.universityId)
    .single();

  if (!university) {
    await sendMessage(botConfig.token, chatId, 'Service configuration error.');
    return;
  }

  // RAG: Search for relevant documents (uses DB rag_settings for topK/threshold)
  const searchResults = await searchDocuments(text, botConfig.universityId, {
    language,
  });

  // Assess confidence
  const confidence = assessConfidence(searchResults);

  // Build system prompt with context
  const systemPrompt = buildSystemPrompt(
    university.name,
    language,
    searchResults
  );

  // Get conversation history (only recent messages to prevent old context from overriding RAG)
  const chatMessages = await buildChatMessages(supabase, conversationId, systemPrompt);

  // Non-streaming OpenAI call
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: LLM_MODEL,
    messages: chatMessages,
    stream: false,
    max_tokens: LLM_MAX_TOKENS_CHAT,
    temperature: LLM_TEMPERATURE,
  });

  let responseText = completion.choices[0]?.message?.content || '';

  // Strip any followups marker or LLM-generated sources block
  responseText = responseText.replace(/\s*<!--followups:\[[\s\S]*?\]-->\s*$/, '').trimEnd();
  responseText = responseText.replace(/\s*📚\s*Sources?:[\s\S]*$/, '').trimEnd();

  // If confidence is low, append fallback
  if (confidence.level === 'low' && searchResults.length === 0) {
    responseText += '\n\n---\n\n' + (FALLBACK_MESSAGES[language] || FALLBACK_MESSAGES['ko']);
  }

  // Append sources inline (deduplicated by file_name)
  const dbSources = deduplicateSources(searchResults);
  if (dbSources.length > 0) {
    const sourcesList = dbSources
      .slice(0, 3)
      .map((s, i) => `${i + 1}. ${s.title} (${Math.round(s.similarity * 100)}%)`)
      .join('\n');
    responseText += `\n\n📚 Sources:\n${sourcesList}`;
  }

  const assistantMsgId = uuidv4();
  await supabase.from('messages').insert({
    id: assistantMsgId,
    conversation_id: conversationId,
    role: 'assistant',
    content: responseText,
    sources: dbSources.length > 0 ? dbSources : null,
  });

  // Send response via Telegram
  await sendMessage(botConfig.token, chatId, responseText);
}
