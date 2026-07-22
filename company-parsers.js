"use strict";

window.JobParserConfig = {
  defaultCompany: "株式会社NTTデータ",
  companies: {
    "株式会社NTTデータ": {
      aliases: ["NTT DATA", "NTTデータ株式会社", "NTTデータ", "NTTData", "NTT Data"],
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
      aliases: ["富士通 株式会社", "富士通Japan株式会社", "富士通JAPAN株式会社", "富士通Japan 株式会社", "Fujitsu Japan", "FUJITSU LIMITED", "Fujitsu"],
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
    "日本アイ・ビー・エム株式会社": {
      aliases: ["日本IBM", "日本 IBM", "日本アイビーエム", "IBM Japan", "IBM", "IBM Japan Digital Services", "IJDS", "日本アイ・ビー・エムデジタルサービス"],
      titlePattern: ".+",
      titleMatchIndex: 0,
      fixedAnnualIncomeRaw: "700-1200万円",
      headings: {
        company: [],
        description: [
          "職務内容",
          "業務内容",
          "ポジション概要",
          "Your role and responsibilities",
          "Your Role and Responsibilities",
          "Introduction"
        ],
        appealPoints: ["このポジションの魅力", "IBMについて", "About IBM", "Being You @ IBM"],
        referenceInfo: ["事業部について", "About Business Unit", "Wonder if IBM is the one for you?"],
        requiredSkills: [
          "必要なスキル・経験",
          "必須スキル",
          "Required Technical and Professional Expertise",
          "Required expertise"
        ],
        requiredLanguage: [],
        requiredCertifications: [
          "必要なスキル・経験",
          "Required Technical and Professional Expertise",
          "Required expertise"
        ],
        preferredSkills: [
          "歓迎するスキル・経験",
          "歓迎スキル",
          "Preferred Technical and Professional Expertise",
          "Preferred expertise"
        ],
        preferredLanguage: [],
        preferredCertifications: [
          "歓迎するスキル・経験",
          "Preferred Technical and Professional Expertise",
          "Preferred expertise"
        ],
        income: [],
        location: ["勤務地", "Location", "Locations"]
      },
      sectionHeadings: [
        "職務内容", "業務内容", "ポジション概要", "応募資格", "必要なスキル・経験", "必須スキル",
        "歓迎するスキル・経験", "歓迎スキル", "勤務地", "Introduction",
        "Your role and responsibilities", "Your Role and Responsibilities",
        "Required Technical and Professional Expertise", "Required expertise",
        "Preferred Technical and Professional Expertise", "Preferred expertise",
        "About IBM", "Being You @ IBM", "About Business Unit", "Wonder if IBM is the one for you?"
      ],
      ignoreSkillPatterns: [
        "必須", "歓迎", "経験", "資格", "応募資格", "職務内容", "業務内容", "勤務地", "ポジション",
        "IBM", "お客様", "プロジェクト", "チーム", "コミュニケーション", "ビジネス", "以上", "以下"
      ]
    },
    "トヨタ自動車株式会社": {
      aliases: ["トヨタ自動車", "TOYOTA MOTOR CORPORATION", "Toyota Motor Corporation", "Toyota"],
      titlePattern: ".+",
      titleMatchIndex: 0,
      headings: {
        company: [],
        description: ["業務内容"],
        appealPoints: ["やりがい・PR", "特色"],
        referenceInfo: ["職場イメージ・職場ミッション", "在宅勤務", "採用の背景"],
        requiredSkills: ["応募資格"],
        requiredLanguage: [],
        requiredCertifications: ["応募資格"],
        preferredSkills: ["＜WANT＞", "WANT"],
        preferredLanguage: [],
        preferredCertifications: ["＜WANT＞", "WANT"],
        income: ["待遇等"],
        location: ["勤務地"]
      },
      qualificationMarkers: {
        must: ["＜MUST＞", "MUST"],
        want: ["＜WANT＞", "WANT"],
        stop: ["待遇等", "職場イメージ・職場ミッション", "やりがい・PR", "在宅勤務", "採用の背景"]
      },
      sectionHeadings: [
        "職種", "勤務地", "特色", "勤務形態", "業務内容", "応募資格", "待遇等",
        "職場イメージ・職場ミッション", "やりがい・PR", "在宅勤務", "採用の背景",
        "＜MUST＞", "＜WANT＞", "MUST", "WANT"
      ],
      ignoreSkillPatterns: [
        "必須", "歓迎", "経験", "資格", "応募資格", "下記", "関する", "有している方", "いずれか",
        "勤務地", "待遇", "想定年収", "勤務形態", "正社員", "役割", "メンバー", "チームリーダー", "マネージャー"
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
        "【MUST】", "【WANT】", "【採用形態・ランク】", "【想定報酬】"
      ],
      ignoreSkillPatterns: [
        "必須", "歓迎", "経験", "資格", "主任", "プロフェッショナル", "課長相当",
        "場合", "以下", "以上", "満たすこと", "勤務地", "待遇", "採用形態",
        "求める人物像", "ソフトスキル", "前職年収", "当社規定", "個別相談"
      ]
    },
    "アクセンチュア株式会社": {
      aliases: ["アクセンチュア", "Accenture", "Accenture Japan"],
      titlePattern: ".+",
      titleMatchIndex: 0,
      fixedAnnualIncomeRaw: "700-1200万円",
      headings: {
        company: [],
        description: ["業務内容"],
        appealPoints: ["■プロジェクト事例"],
        referenceInfo: ["追加情報"],
        requiredSkills: ["【必須条件】", "◆応募要件", "応募要件"],
        requiredLanguage: [],
        requiredCertifications: ["【必須条件】", "◆応募要件", "応募要件"],
        preferredSkills: ["【歓迎要件】", "◆望ましい経験・スキル", "望ましい経験・スキル"],
        preferredLanguage: [],
        preferredCertifications: ["【歓迎要件】", "◆望ましい経験・スキル", "望ましい経験・スキル"],
        income: [],
        location: ["【勤務地】", "勤務地"]
      },
      sectionHeadings: [
        "業務内容", "募集要項", "◆応募要件", "応募要件", "◆望ましい経験・スキル", "望ましい経験・スキル", "【必須条件】", "【歓迎要件】", "【勤務地】",
        "■プロジェクト事例", "※このような志をお持ちの方を特に歓迎しております※",
        "勤務地", "追加情報", "雇用機会の均等化に関する声明", "会社情報"
      ],
      ignoreSkillPatterns: [
        "必須", "歓迎", "経験", "要件", "条件", "お持ち", "方", "勤務地", "募集要項",
        "尚歓迎", "英語力", "ビジネスレベル", "志", "人", "等々", "追加情報", "会社情報"
      ]
    },
    "株式会社野村総合研究所": {
      aliases: ["野村総合研究所", "NRI", "Nomura Research Institute"],
      titlePattern: ".+",
      titleMatchIndex: 0,
      fixedAnnualIncomeRaw: "600-1300万円",
      headings: {
        company: [],
        description: ["【具体的な職務内容】"],
        appealPoints: ["【仕事の魅力・やりがい・キャリアパス】"],
        referenceInfo: ["【組織の概要】"],
        requiredSkills: ["【必須スキル・経験・資格】"],
        requiredLanguage: [],
        requiredCertifications: ["【必須スキル・経験・資格】"],
        preferredSkills: ["【歓迎するスキル・経験・資格】"],
        preferredLanguage: [],
        preferredCertifications: ["【歓迎するスキル・経験・資格】"],
        income: [],
        location: ["勤務地"]
      },
      sectionHeadings: [
        "職務内容", "登録資格", "勤務地", "【配属想定組織】", "【組織の概要】",
        "【募集職種の期待役割】", "【具体的な職務内容】", "【仕事の魅力・やりがい・キャリアパス】",
        "【必須スキル・経験・資格】", "【歓迎するスキル・経験・資格】"
      ],
      ignoreSkillPatterns: [
        "必須", "歓迎", "経験", "資格", "以下", "いずれ", "顧客", "お客さま", "案件",
        "行った", "関わった", "複数", "業界", "一連", "クラス", "ご経験"
      ]
    }
  },
  skillDictionary: [
    "JavaScript", "TypeScript", "Python", "Java", "Webアプリケーション", "オープン系システム", "Salesforce", "CRM", "RPA", "JLPT N1", "日本語", "C#", "C++", "Go", "Ruby", "PHP",
    "SQL", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "React", "Vue", "Angular",
    "Spring", "Linux", "Git", "SCM", "ERP", "SAP", "SAP S/4HANA", "Oracle Cloud SCM",
    "Kinaxis", "Kinaxis Maestro", "Anaplan", "O9", "mcframe", "PMP", "ASCM",
    "CPIM", "CSCP", "CLTD", "IoT", "DX", "要件定義", "設計", "開発", "運用",
    "クラウド", "データ分析", "データサイエンス", "データサイエンティスト",
    "医療データ", "医療情報", "ビッグデータ", "データ解析", "統計解析",
    "機械学習", "生成AI", "プロジェクトマネジメント",
    "ステークホルダーマネジメント", "チームリード", "チームリーダー", "リーダー",
    "リーダーシップ", "テックリード", "リードエンジニア", "エンジニアリングマネージャー",
    "プロジェクトリーダー", "プロジェクトマネージャー", "プロジェクト推進", "サブリーダー",
    "マネジメント", "メンバーマネジメント", "ラインマネジメント", "組織マネジメント",
    "アジャイル", "セキュリティ",
    "ネットワーク", "データベース", "データ基盤", "ETL", "BI", "QCD", "顧客折衝",
    "PL", "PM", "サプライチェーン", "物流", "調達", "生産計画", "在庫", "品質管理",
    "HPC", "AI", "CPU", "NPU", "GPGPU", "OSS", "PyTorch", "TensorFlow", "vLLM",
    "電気回路", "電子回路", "アナログ回路", "デジタル回路", "高周波回路", "RF回路",
    "高速信号", "信号処理", "信号品質", "SI", "PI", "EMC", "EMI", "ノイズ対策",
    "回路設計", "基板設計", "PCB設計", "プリント基板", "多層基板", "実装設計",
    "電源回路", "電源設計", "パワーエレクトロニクス", "インバータ", "コンバータ",
    "モータ制御", "制御回路", "センサ", "センサ回路", "計測", "評価", "検証",
    "オシロスコープ", "ロジックアナライザ", "スペクトラムアナライザ", "ネットワークアナライザ",
    "SPICE", "LTspice", "回路シミュレーション", "電磁界解析", "熱設計", "放熱設計",
    "光部品", "光デバイス", "光通信", "光伝送", "光トランシーバ", "光モジュール",
    "レーザー", "フォトニクス", "光学設計", "光学評価", "光ファイバ", "シリコンフォトニクス",
    "半導体", "LSI", "ASIC", "FPGA", "RTL", "Verilog", "SystemVerilog", "VHDL",
    "SoC", "HDL", "論理設計", "論理合成", "タイミング解析", "STA", "DFT",
    "組み込みハードウェア", "ファームウェア", "マイコン", "MCU", "UART", "SPI", "I2C", "CAN",
    "コンピューターシステム", "コンピュータシステム", "計算機システム", "サーバーシステム",
    "分散システム", "並列分散処理", "クラスタ", "クラスター", "HAクラスタ", "HPCクラスタ",
    "システム基盤", "IT基盤", "基盤システム", "情報システム", "業務システム", "基幹システム",
    "ミドルウェア", "Webサーバ", "アプリケーションサーバ", "DBサーバ", "認証基盤",
    "サーバ", "サーバー", "Linuxサーバ", "Windowsサーバ", "物理サーバ", "ラックサーバ",
    "ブレードサーバ", "x86サーバ", "HCI", "仮想化基盤", "VMware vSphere", "Hyper-V", "KVM",
    "ESXi", "vCenter", "OpenStack", "Nutanix", "Proxmox", "ベアメタル", "オンプレ基盤", "インフラ設計", "インフラ構築", "インフラ運用",
    "サーバ構築", "サーバ運用", "運用監視", "運用・保守", "運用保守", "保守運用",
    "保守", "維持管理", "監視設計", "障害対応", "性能設計",
    "キャパシティプランニング", "可用性設計", "冗長化", "バックアップ", "リストア",
    "DR", "BCP", "ストレージ", "SAN", "NAS", "RAID", "ファイルサーバ", "オブジェクトストレージ",
    "ネットワーク設計", "ネットワーク構築", "ネットワーク運用", "LAN", "WAN", "SD-WAN",
    "TCP/IP", "IPv4", "IPv6", "DNS", "DHCP", "NTP", "LDAP", "Kerberos", "OpenLDAP",
    "HTTP", "HTTPS", "TLS", "Apache", "Nginx", "Tomcat", "IIS", "Samba", "NFS", "SMB",
    "ルータ", "スイッチ", "L2スイッチ", "L3スイッチ", "ロードバランサ", "ADC",
    "ファイアウォール", "WAF", "IDS", "IPS", "VPN", "IPsec", "SSL-VPN", "NAT",
    "VLAN", "VXLAN", "BGP", "OSPF", "QoS", "CDN", "無線LAN", "Wi-Fi",
    "データセンター", "ラック", "配線", "ケーブリング", "電源設備", "UPS", "空調",
    "ハードウェア保守", "ハードウェア障害", "キッティング", "ラッキング", "ファームウェア更新",
    "RHEL", "Red Hat Enterprise Linux", "Ubuntu Server", "CentOS", "Rocky Linux", "AlmaLinux",
    "SUSE Linux", "AIX", "Solaris", "JP1", "Hinemos", "Zabbix", "Nagios",
    "メインフレーム", "汎用機", "ホスト", "ホストコンピュータ", "ホストコンピューター",
    "大型汎用機", "基幹系ホスト", "勘定系システム", "基幹系システム", "レガシーシステム",
    "モダナイゼーション", "レガシーマイグレーション", "マイグレーション", "リホスト",
    "リライト", "COBOL", "PL/I", "JCL", "EASY", "AIM", "DB/DC", "IMS", "CICS",
    "Db2", "DB2", "VSAM", "RACF", "TSO", "ISPF", "z/OS", "zLinux", "z/VM",
    "IBM Z", "System z", "ACOS", "VOS3", "XSP", "MSP", "GS21", "PRIMEFORCE",
    "A-AUTO", "HULFT", "ジョブ管理", "バッチ処理", "オンライン処理", "帳票",
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
    "Aurora", "PoC", "POC", "概念実証", "実証実験", "技術検証", "検証業務",
    "フィジビリティ検証", "プロトタイピング", "プロトタイプ開発", "研究", "研究開発",
    "応用研究", "基礎研究", "技術調査", "先行開発", "要素技術開発", "実証研究",
    "企画", "製品企画", "事業企画", "技術企画", "提案", "提案活動", "導入支援",
    "導入コンサル", "プリセールス", "セールスエンジニア", "技術支援", "顧客支援",
    "プロジェクト推進", "プロジェクト管理", "開発リード", "技術リード", "アーキテクト",
    "アーキテクチャ設計", "ソリューション設計", "要件整理", "課題解決", "改善提案",
    "医療DX", "ガバメントクラウド", "BPO", "RPA", "業務改革", "コンサルティング",
    "システム構築", "デジタルトランスフォーメーション", "業務移管", "案件立上げ",
    "事業立上げ", "組織変革", "デジタル変革", "SI営業", "新規顧客開拓",
    "アカウントマネジメント", "ソリューション企画", "金額交渉", "業務要件定義",
    "システム構想", "CXO",
    "官公庁", "公共", "社会保障", "顧客課題", "顧客ニーズ", "クラウドネイティブ"
  ],
  certificationDictionary: [
    "PMP", "プロジェクトマネージャ", "システムアーキテクト", "データベーススペシャリスト",
    "ネットワークスペシャリスト", "情報処理安全確保支援士", "ASCM", "CPIM", "CSCP", "CLTD",
    "SAP S/4HANA", "Oracle Cloud SCM", "Kinaxis Maestro", "Anaplan", "mcframe",
    "ITパスポート", "情報セキュリティマネジメント",
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
    "CompTIA Security+", "簿記", "簿記3級", "簿記2級",
    "ITストラテジスト", "エンベデッドシステムスペシャリスト",
    "ITサービスマネージャ", "システム監査技術者",
    "AWS Certified AI Practitioner", "AWS Certified CloudOps Engineer - Associate",
    "AWS Certified Data Engineer - Associate", "AWS Certified Developer - Associate",
    "AWS Certified Machine Learning Engineer - Associate",
    "AWS Certified Solutions Architect - Associate", "AWS Certified DevOps Engineer - Professional",
    "AWS Certified Generative AI Developer - Professional",
    "AWS Certified Solutions Architect - Professional",
    "AWS Certified Advanced Networking - Specialty", "AWS Certified Security - Specialty",
    "AWS Certified Machine Learning - Specialty",
    "Google Cloud Cloud Digital Leader", "Google Cloud Generative AI Leader",
    "Google Cloud Associate Google Workspace Administrator",
    "Google Cloud Associate Data Practitioner", "Google Cloud Professional Cloud Database Engineer",
    "Google Cloud Professional Cloud Security Engineer",
    "Google Cloud Professional Cloud Network Engineer",
    "Google Cloud Professional Machine Learning Engineer",
    "Google Cloud Professional Security Operations Engineer",
    "Cloud Digital Leader", "Generative AI Leader", "Associate Cloud Engineer",
    "Associate Google Workspace Administrator", "Associate Data Practitioner",
    "Professional Cloud Architect", "Professional Cloud Database Engineer",
    "Professional Cloud Developer", "Professional Data Engineer", "Professional Cloud DevOps Engineer",
    "Professional Cloud Security Engineer", "Professional Cloud Network Engineer",
    "Professional Machine Learning Engineer", "Professional Security Operations Engineer"
  ]
};
