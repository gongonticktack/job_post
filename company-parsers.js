"use strict";

window.JobParserConfig = {
  defaultCompany: "NTT DATA",
  companies: {
    "NTT DATA": {
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
    }
  },
  skillDictionary: [
    "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "Go", "Ruby", "PHP",
    "SQL", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "React", "Vue", "Angular",
    "Spring", "Linux", "Git", "SCM", "ERP", "SAP", "SAP S/4HANA", "Oracle Cloud SCM",
    "Kinaxis", "Kinaxis Maestro", "Anaplan", "O9", "mcframe", "PMP", "IPA", "ASCM",
    "CPIM", "CSCP", "CLTD", "IoT", "DX", "要件定義", "設計", "開発", "運用",
    "クラウド", "データ分析", "機械学習", "生成AI", "プロジェクトマネジメント",
    "ステークホルダーマネジメント", "チームリード", "アジャイル", "セキュリティ",
    "ネットワーク", "データベース", "データ基盤", "ETL", "BI", "QCD", "顧客折衝",
    "PL", "PM", "サプライチェーン", "物流", "調達", "生産計画", "在庫", "品質管理",
    "HPC", "AI", "CPU", "NPU", "GPGPU", "OSS", "PyTorch", "TensorFlow", "vLLM",
    "OS", "ドライバ", "コンパイラ", "プロファイラ", "デバッガ",
    "コンピューターアーキテクチャ", "ソフトウェア開発", "ハードウェア",
    "チームマネジメント", "研究開発", "アクセラレータ", "オープンソースソフトウェア"
  ],
  certificationDictionary: [
    "PMP", "IPA", "プロジェクトマネージャ", "システムアーキテクト", "データベース",
    "ネットワーク", "情報処理安全確保支援士", "ASCM", "CPIM", "CSCP", "CLTD",
    "SAP S/4HANA", "Oracle Cloud SCM", "Kinaxis Maestro", "Anaplan", "mcframe",
    "応用情報技術者", "基本情報技術者", "AWS Certified Solutions Architect",
    "AWS Certified Developer", "AWS Certified SysOps Administrator",
    "Azure Administrator", "Azure Solutions Architect", "Google Cloud Professional Cloud Architect"
  ]
};
