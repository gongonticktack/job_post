"use strict";

window.JobParserConfig = {
  defaultCompany: "NTT DATA",
  companies: {
    "NTT DATA": {
      aliases: ["株式会社NTTデータ", "NTTデータ株式会社", "NTTデータ", "NTTData", "NTT Data"],
      titlePattern: "^【.+?】",
      titleMatchIndex: 1,
      headings: {
        company: ["募集元"],
        description: ["職務内容"],
        appealPoints: ["アピールポイント"],
        referenceInfo: ["参考情報"],
        requiredSkills: ["【必要条件】求める経験・スキル・知識", "必要条件】求める経験・スキル・知識"],
        requiredLanguage: ["【必要条件】他言語力", "必要条件】他言語力"],
        requiredCertifications: ["【必要条件】資格", "必要条件】資格"],
        preferredSkills: ["【歓迎条件】求める経験・スキル・知識", "歓迎条件】求める経験・スキル・知識"],
        preferredLanguage: ["【歓迎条件】他言語力", "歓迎条件】他言語力"],
        preferredCertifications: ["【歓迎条件】資格", "歓迎条件】資格"],
        income: ["待遇"],
        location: ["勤務地"]
      },
      sectionHeadings: [
        "募集元", "職務内容", "アピールポイント", "参考情報",
        "【必要条件】求める経験・スキル・知識", "【必要条件】他言語力", "【必要条件】資格",
        "【歓迎条件】求める経験・スキル・知識", "【歓迎条件】他言語力", "【歓迎条件】資格",
        "雇用形態", "想定役職", "労働形態", "待遇", "勤務地"
      ],
      ignoreSkillPatterns: [
        "特になし", "必須", "歓迎", "条件", "以上", "以下", "勤務地", "勤務", "資格", "語学", "英語力"
      ]
    },
    "富士通株式会社": {
      aliases: ["富士通 株式会社"],
      titlePattern: ".+",
      titleMatchIndex: 0,
      headings: {
        company: ["【会社名】"],
        description: ["【募集範囲と具体的業務内容】"],
        appealPoints: ["【仕事の魅力・やりがい】"],
        referenceInfo: ["【募集背景と応募者へのメッセージ】"],
        requiredSkills: ["【必須の経験・キャリアや資格・言語】"],
        requiredLanguage: ["【語学力】"],
        requiredCertifications: ["【必須の経験・キャリアや資格・言語】"],
        preferredSkills: ["【歓迎する経験・キャリアや資格・言語】"],
        preferredLanguage: ["【日本語レベル】"],
        preferredCertifications: ["【歓迎する経験・キャリアや資格・言語】"],
        income: ["【給与】"],
        location: ["【勤務地】"]
      },
      sectionHeadings: [
        "勤務地域", "Location Flexibility", "求人ID", "掲載開始日",
        "【募集テーマ】", "－－－職務内容－－－－－－", "【会社名】", "【BG名】", "【本部名】",
        "【組織としてのミッション】", "【募集背景と応募者へのメッセージ】", "【担当業界・業種】",
        "【就業環境・勤務形態】", "【募集範囲と具体的業務内容】", "【個人に期待する役割やミッション】",
        "【仕事の魅力・やりがい】", "【Role Group】", "【Role Family】", "【Role Specialism】",
        "【Job Function】", "【募集人数】", "－－－求める資格・スキル・経験など－－－－－－",
        "【必須の経験・キャリアや資格・言語】", "【歓迎する経験・キャリアや資格・言語】",
        "【語学力】", "【日本語レベル】", "－－－待遇－－－－－－", "【ポジション名】", "【給与】",
        "－－－勤務地－－－－－－", "【勤務地】", "【主な勤務地（上記以外）】", "－－－備考－－－－－－",
        "【業務内容の変更の範囲】", "【契約期間】", "【就業場所の変更の範囲】"
      ],
      ignoreSkillPatterns: [
        "必須", "歓迎", "経験", "知見", "資格", "言語", "以下", "以上", "勤務地", "勤務", "日常会話", "希望"
      ]
    },
    "株式会社トヨタシステムズ": {
      aliases: ["トヨタシステムズ", "株式会社 トヨタシステムズ"],
      titlePattern: ".+",
      titleMatchIndex: 0,
      headings: {
        company: [],
        description: ["職務内容"],
        appealPoints: ["【求人のポイント】"],
        referenceInfo: ["【目指す姿】", "【教育/成長環境】"],
        requiredSkills: ["【必須】"],
        requiredLanguage: [],
        requiredCertifications: [],
        preferredSkills: ["【歓迎】"],
        preferredLanguage: [],
        preferredCertifications: [],
        income: ["待遇"],
        location: ["勤務地"]
      },
      sectionHeadings: [
        "職務内容", "応募資格", "待遇", "勤務地",
        "【必須】", "【歓迎】", "＜補足＞", "（１）就業場所", "（２）業務内容"
      ],
      ignoreSkillPatterns: [
        "必須", "歓迎", "経験", "ご経験", "お持ち", "方", "問いません", "勤務地", "待遇", "雇用", "試用期間"
      ]
    },
    "NEC": {
      aliases: ["日本電気株式会社", "NEC Corporation", "日本電気"],
      titlePattern: "^\\d+\\s+.+",
      titleMatchIndex: 0,
      headings: {
        company: [],
        description: ["【職務内容】"],
        appealPoints: ["【ポジションのアピールポイント】"],
        referenceInfo: ["【職場環境】", "備考 / Notes"],
        requiredSkills: ["応募資格 / Qualifications"],
        requiredLanguage: [],
        requiredCertifications: ["応募資格 / Qualifications"],
        preferredSkills: ["【WANT】"],
        preferredLanguage: [],
        preferredCertifications: ["【WANT】"],
        income: ["【想定報酬】"],
        location: ["勤務地 / Location"]
      },
      sectionHeadings: [
        "職務内容 / Job duties", "応募資格 / Qualifications", "待遇 / Salary & Benefits",
        "勤務地 / Location", "備考 / Notes",
        "【事業・組織構成の概要】", "【職務内容】", "【ポジションのアピールポイント】",
        "【職場環境】", "【求める人物像・ソフトスキル】",
        "【採用形態・ランク】", "【想定報酬】"
      ],
      ignoreSkillPatterns: [
        "必須", "歓迎", "経験", "資格", "主任", "プロフェッショナル", "課長相当",
        "場合", "以下", "以上", "満たすこと", "勤務地", "待遇", "採用形態",
        "求める人物像", "ソフトスキル", "前職年収", "当社規定", "個別相談"
      ]
    }
  },
  skillDictionary: [
    "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "Go", "Ruby", "PHP",
    "SQL", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "React", "Vue", "Angular",
    "Spring", "Linux", "Git", "SCM", "ERP", "SAP", "SAP S/4HANA", "Oracle Cloud SCM",
    "Kinaxis", "Kinaxis Maestro", "Anaplan", "O9", "mcframe", "PMP", "IPA", "ASCM",
    "CPIM", "CSCP", "CLTD", "IoT", "DX", "要件定義", "設計", "開発", "運用",
    "クラウド", "データ分析", "機械学習", "生成AI", "プロジェクトマネジメント",
    "ステークホルダーマネジメント", "チームリード", "チームリーダー", "リーダー",
    "リーダーシップ", "テックリード", "リードエンジニア", "エンジニアリングマネージャー",
    "プロジェクトリーダー", "プロジェクトマネージャー", "プロジェクト推進", "サブリーダー",
    "マネジメント", "メンバーマネジメント", "ラインマネジメント", "組織マネジメント",
    "アジャイル", "セキュリティ",
    "ネットワーク", "データベース", "データ基盤", "ETL", "BI", "QCD", "顧客折衝",
    "PL", "PM", "サプライチェーン", "物流", "調達", "生産計画", "在庫", "品質管理",
    "HPC", "AI", "CPU", "NPU", "GPGPU", "OSS", "PyTorch", "TensorFlow", "vLLM",
    "OS", "ドライバ", "コンパイラ", "プロファイラ", "デバッガ",
    "コンピューターアーキテクチャ", "ソフトウェア開発", "ハードウェア",
    "チームマネジメント", "研究開発", "アクセラレータ", "オープンソースソフトウェア",
    "組み込みシステム", "組み込み", "Webシステム", "制御システム", "制御モデル",
    "車両性能シミュレーション", "モデルベース開発", "エンジニアリングシステム",
    "オンプレミス", "仕様定義", "上流工程", "ベンダーコントロール",
    "アプリケーション開発", "詳細設計", "テスト", "システム開発", "運用サポート",
    "開発環境", "情報管理システム", "Teamcenter", "integrity", "MATLAB", "Simulink", "TargetLink",
    "Node.js", "Next.js", "Nuxt", "Express", "NestJS", "Django", "Flask", "FastAPI",
    "Laravel", "Rails", "Spring Boot", ".NET", "ASP.NET", "Unity", "Unreal Engine",
    "Swift", "Kotlin", "Scala", "Rust", "R", "VBA", "Shell", "Bash", "PowerShell",
    "HTML", "CSS", "Sass", "Tailwind CSS", "GraphQL", "REST API", "gRPC", "Web API",
    "PostgreSQL", "MySQL", "Oracle", "SQL Server", "MongoDB", "Redis", "Elasticsearch",
    "DynamoDB", "BigQuery", "Snowflake", "Redshift", "Databricks",
    "Terraform", "Ansible", "Jenkins", "GitHub Actions", "CI/CD", "DevOps", "SRE",
    "Prometheus", "Grafana", "Datadog", "New Relic", "Splunk", "MLOps", "LLM", "RAG",
    "Kaggle", "Tableau", "Power BI", "Looker", "dbt", "DWH", "データマート",
    "マイクロサービス", "API設計", "基本設計", "外部設計", "内部設計", "単体テスト",
    "結合テスト", "総合テスト", "UAT", "品質保証", "QA", "テスト自動化",
    "スクラム", "ウォーターフォール", "PMO", "WBS", "課題管理", "リスク管理",
    "進捗管理", "品質管理", "予算管理", "要員管理", "体制構築", "チームビルディング",
    "ベンダーマネジメント", "ベンダー管理", "パートナー管理", "パートナー折衝",
    "ピープルマネジメント", "プロダクトマネジメント", "プロダクトオーナー",
    "プロダクトオーナーシップ", "プロダクト責任者", "プロダクト企画", "ロードマップ策定",
    "PdM", "PO", "ITコンサル",
    "業務改善", "BPR", "ITIL", "インシデント管理", "SLA", "ITSM", "ゼロトラスト",
    "認証", "認可", "OAuth", "OIDC", "SAML", "Active Directory", "Entra ID",
    "Windows Server", "VMware", "OpenShift", "EKS", "AKS", "Cloud Run", "Lambda",
    "Aurora", "PoC", "フィジビリティ検証", "医療DX", "ガバメントクラウド",
    "官公庁", "公共", "社会保障", "顧客課題", "顧客ニーズ", "クラウドネイティブ"
  ],
  certificationDictionary: [
    "PMP", "プロジェクトマネージャ試験", "システムアーキテクト試験", "データベーススペシャリスト",
    "ネットワークスペシャリスト", "情報処理安全確保支援士", "ASCM", "CPIM", "CSCP", "CLTD",
    "SAP S/4HANA", "Oracle Cloud SCM", "Kinaxis Maestro", "Anaplan", "mcframe",
    "応用情報技術者", "基本情報技術者", "AWS Certified Solutions Architect",
    "AWS Certified Developer", "AWS Certified SysOps Administrator",
    "Azure Administrator", "Azure Solutions Architect", "Google Cloud Professional Cloud Architect",
    "ITIL", "ITIL Foundation", "Certified ScrumMaster", "Certified Scrum Product Owner",
    "Professional Scrum Master", "Professional Scrum Product Owner", "SAFe Agilist", "SAFe POPM",
    "AWS Certified Cloud Practitioner", "AWS Certified DevOps Engineer",
    "AWS Certified Security", "AWS Certified Machine Learning",
    "Microsoft Certified Azure Fundamentals", "Azure Developer Associate",
    "Azure DevOps Engineer Expert", "Azure Security Engineer Associate",
    "Google Cloud Associate Cloud Engineer", "Google Cloud Professional Data Engineer",
    "Google Cloud Professional Cloud Developer", "Google Cloud Professional Cloud DevOps Engineer",
    "Oracle Certified Java Programmer", "Oracle Certified Professional",
    "Oracle Master", "CCNA", "CCNP", "LPIC", "LinuC", "CISSP", "CISA", "CISM",
    "CompTIA Security+", "簿記", "簿記3級", "簿記2級"
  ]
};
