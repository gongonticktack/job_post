"use strict";

window.JobParserConfig = {
  defaultCompany: "NTT DATA",
  companies: {
    "NTT DATA": {
      titlePattern: /^【.+?】/,
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
    "PL", "PM", "サプライチェーン", "物流", "調達", "生産計画", "在庫", "品質管理"
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
