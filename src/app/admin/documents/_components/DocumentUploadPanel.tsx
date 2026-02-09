interface DocumentUploadPanelProps {
  activeTab: 'file' | 'url' | 'qa';
  setActiveTab: (tab: 'file' | 'url' | 'qa') => void;
  uploading: boolean;
  uploadProgress: string;
  useVision: boolean;
  setUseVision: (v: boolean) => void;
  urlInput: string;
  setUrlInput: (v: string) => void;
  qaQuestion: string;
  setQaQuestion: (v: string) => void;
  qaAnswer: string;
  setQaAnswer: (v: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUrlSubmit: () => void;
  onQaSubmit: () => void;
}

export function DocumentUploadPanel({
  activeTab,
  setActiveTab,
  uploading,
  uploadProgress,
  useVision,
  setUseVision,
  urlInput,
  setUrlInput,
  qaQuestion,
  setQaQuestion,
  qaAnswer,
  setQaAnswer,
  onFileUpload,
  onUrlSubmit,
  onQaSubmit,
}: DocumentUploadPanelProps) {
  return (
    <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex gap-2">
        {(['file', 'url', 'qa'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab === 'file' ? '파일 업로드' : tab === 'url' ? 'URL 크롤링' : 'Q&A 등록'}
          </button>
        ))}
      </div>

      {activeTab === 'file' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-gray-300 p-8">
          <p className="text-sm text-gray-500">PDF, HWP 파일을 업로드하세요 (최대 10MB, 여러 파일 선택 가능)</p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={useVision}
              onChange={(e) => setUseVision(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span>Vision 모드 (테이블이 있는 PDF에 권장)</span>
          </label>
          <label className="cursor-pointer rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {uploading ? '업로드 중...' : '파일 선택'}
            <input type="file" accept=".pdf,.hwp" multiple onChange={onFileUpload} disabled={uploading} className="hidden" />
          </label>
          {uploading && uploadProgress && (
            <p className="text-xs text-gray-500">{uploadProgress}</p>
          )}
          {useVision && (
            <p className="text-xs text-amber-600">Vision 모드는 GPT-4 Vision API를 사용하여 처리 시간과 비용이 증가합니다.</p>
          )}
        </div>
      )}

      {activeTab === 'url' && (
        <div className="space-y-3">
          <textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={"https://example.com/page1\nhttps://example.com/page2\nhttps://example.com/page3"}
            rows={4}
            className="w-full resize-none rounded-lg border bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              한 줄에 하나의 URL을 입력하세요 ({urlInput.split('\n').filter((l) => l.trim()).length}개)
            </p>
            <button
              onClick={onUrlSubmit}
              disabled={uploading || !urlInput.trim()}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? '처리 중...' : '크롤링'}
            </button>
          </div>
          {uploading && uploadProgress && (
            <p className="text-xs text-gray-500">{uploadProgress}</p>
          )}
        </div>
      )}

      {activeTab === 'qa' && (
        <div className="space-y-3">
          <input
            value={qaQuestion}
            onChange={(e) => setQaQuestion(e.target.value)}
            placeholder="질문을 입력하세요"
            className="w-full rounded-lg border bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
          />
          <textarea
            value={qaAnswer}
            onChange={(e) => setQaAnswer(e.target.value)}
            placeholder="답변을 입력하세요"
            rows={4}
            className="w-full resize-none rounded-lg border bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
          />
          <button
            onClick={onQaSubmit}
            disabled={uploading || !qaQuestion.trim() || !qaAnswer.trim()}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? '처리 중...' : 'Q&A 등록'}
          </button>
        </div>
      )}
    </div>
  );
}
