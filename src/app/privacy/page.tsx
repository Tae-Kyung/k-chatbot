export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">
        개인정보처리방침
      </h1>

      <div className="space-y-6 text-sm leading-relaxed text-gray-700">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            1. 개인정보의 수집 및 이용 목적
          </h2>
          <p>
            K-Student Success AI Guide(이하 &quot;서비스&quot;)는 외국인 유학생에게
            학교생활 관련 AI 상담 서비스를 제공하기 위해 최소한의 정보를
            수집합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            2. 수집하는 개인정보 항목
          </h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>채팅 내용:</strong> AI 상담을 위해 입력된 질문 및 대화
              내용
            </li>
            <li>
              <strong>선택 언어:</strong> 서비스 이용 시 선택한 언어 정보
            </li>
            <li>
              <strong>관리자 계정:</strong> 관리자 로그인을 위한 이메일 주소 및
              비밀번호 (암호화 저장)
            </li>
          </ul>
          <p className="mt-2">
            ※ 학생 사용자의 경우 별도의 회원가입이나 로그인이 필요하지 않으며,
            개인식별정보를 수집하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            3. 개인정보의 보유 및 이용 기간
          </h2>
          <p>
            채팅 데이터는 서비스 품질 개선 목적으로 수집일로부터 1년간
            보관됩니다. 보관 기간 경과 후 지체 없이 파기합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            4. 개인정보의 제3자 제공
          </h2>
          <p>
            본 서비스는 수집된 개인정보를 제3자에게 제공하지 않습니다. 다만, AI
            응답 생성을 위해 질문 내용이 OpenAI API로 전송됩니다. OpenAI의
            개인정보 처리 방침은 OpenAI 공식 웹사이트에서 확인할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            5. 개인정보 보호를 위한 기술적 대책
          </h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>모든 데이터 전송은 SSL/TLS로 암호화됩니다.</li>
            <li>관리자 비밀번호는 단방향 해시 함수로 암호화하여 저장합니다.</li>
            <li>
              데이터베이스 접근은 Row Level Security(RLS) 정책으로
              통제됩니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            6. 이용자의 권리
          </h2>
          <p>
            이용자는 언제든지 자신의 채팅 데이터 삭제를 요청할 수 있으며,
            관리자에게 이메일로 요청하시면 지체 없이 처리하겠습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-800">7. 면책 사항</h2>
          <p>
            본 AI 상담 서비스는 참고 정보를 제공하며, 법률적 효력을 가지지
            않습니다. 비자, 체류 자격 등 법적 사안은 반드시 해당 기관이나
            전문가에게 확인하시기 바랍니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            8. 개인정보 보호책임자
          </h2>
          <p>
            본 서비스의 개인정보 보호에 관한 문의는 각 대학교 국제교류팀으로
            연락해 주시기 바랍니다.
          </p>
        </section>

        <p className="mt-8 text-xs text-gray-400">
          본 방침은 2025년 1월 1일부터 시행됩니다.
        </p>
      </div>
    </div>
  );
}
