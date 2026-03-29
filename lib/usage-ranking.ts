/**
 * ポケモンSV 使用率ランキング (シングルバトル・シリーズ40 pokedb.tokyo 参考)
 * ディンルー / パオジアン / コライドン から始まる現環境トップ順
 */
export interface UsageEntry {
  name: string;   // PokeAPI slug
  ja: string;     // 日本語名
  id: number;     // PokeAPI ID (スプライト用)
}

export const USAGE_RANKING: UsageEntry[] = [
  // Top 30 (pokedb.tokyo シリーズ40 最新)
  { name: "ting-lu",               ja: "ディンルー",              id: 1003  },
  { name: "chien-pao",             ja: "パオジアン",              id: 1002  },
  { name: "koraidon",              ja: "コライドン",              id: 1007  },
  { name: "calyrex-shadow",        ja: "バドレックス（黒馬）",    id: 10194 },
  { name: "miraidon",              ja: "ミライドン",              id: 1008  },
  { name: "landorus-therian",      ja: "ランドロス（霊獣）",      id: 10021 },
  { name: "urshifu-rapid-strike",  ja: "ウーラオス（連撃）",      id: 10191 },
  { name: "flutter-mane",          ja: "ハバタクカミ",            id: 987   },
  { name: "glimmora",              ja: "キラフロル",              id: 970   },
  { name: "ho-oh",                 ja: "ホウオウ",                id: 250   },
  { name: "dondozo",               ja: "ヘイラッシャ",            id: 977   },
  { name: "zacian",                ja: "ザシアン",                id: 888   },
  { name: "kyogre",                ja: "カイオーガ",              id: 382   },
  { name: "ursaluna-bloodmoon",    ja: "ガチグマ（アカツキ）",    id: 10272 },
  { name: "dragonite",             ja: "カイリュー",              id: 149   },
  { name: "lunala",                ja: "ルナアーラ",              id: 792   },
  { name: "gliscor",               ja: "グライオン",              id: 472   },
  { name: "garganacl",             ja: "キョジオーン",            id: 934   },
  { name: "mimikyu",               ja: "ミミッキュ",              id: 778   },
  { name: "grimmsnarl",            ja: "オーロンゲ",              id: 861   },
  { name: "clodsire",              ja: "ドオー",                  id: 980   },
  { name: "calyrex-ice",           ja: "バドレックス（白馬）",    id: 10193 },
  { name: "iron-treads",           ja: "テツノワダチ",            id: 990   },
  { name: "ogerpon",               ja: "オーガポン",              id: 1017  },
  { name: "baxcalibur",            ja: "セグレイブ",              id: 998   },
  { name: "chi-yu",                ja: "イーユイ",                id: 1004  },
  { name: "eternatus",             ja: "ムゲンダイナ",            id: 890   },
  { name: "sneasler",              ja: "オオニューラ",            id: 903   },
  { name: "kingambit",             ja: "ドドゲザン",              id: 983   },
  { name: "alomomola",             ja: "ママンボウ",              id: 594   },

  // 31位以降（環境上位・準レギュラー）
  { name: "great-tusk",            ja: "イダイナキバ",            id: 984   },
  { name: "iron-hands",            ja: "テツノカイナ",            id: 992   },
  { name: "iron-valiant",          ja: "テツノブシン",            id: 1006  },
  { name: "roaring-moon",          ja: "トドロクツキ",            id: 1005  },
  { name: "raging-bolt",           ja: "タケルライコ",            id: 1021  },
  { name: "gouging-fire",          ja: "ウガツホムラ",            id: 1020  },
  { name: "garchomp",              ja: "ガブリアス",              id: 445   },
  { name: "gholdengo",             ja: "サーフゴー",              id: 1000  },
  { name: "urshifu-single-strike", ja: "ウーラオス（一撃）",      id: 892   },
  { name: "dragapult",             ja: "ドラパルト",              id: 887   },
  { name: "iron-bundle",           ja: "テツノツツミ",            id: 991   },
  { name: "rillaboom",             ja: "ゴリランダー",            id: 812   },
  { name: "incineroar",            ja: "ガオガエン",              id: 727   },
  { name: "amoonguss",             ja: "モロバレル",              id: 591   },
  { name: "meowscarada",           ja: "マスカーニャ",            id: 908   },
  { name: "groudon",               ja: "グラードン",              id: 383   },
  { name: "tyranitar",             ja: "バンギラス",              id: 248   },
  { name: "skeledirge",            ja: "ラウドボーン",            id: 911   },
  { name: "annihilape",            ja: "コノヨザル",              id: 979   },
  { name: "iron-moth",             ja: "テツノドクガ",            id: 994   },
  { name: "sandy-shocks",          ja: "スナノケガワ",            id: 989   },
  { name: "hatterene",             ja: "ブリムオン",              id: 858   },
  { name: "salamence",             ja: "ボーマンダ",              id: 373   },
  { name: "zapdos",                ja: "サンダー",                id: 145   },
  { name: "volcarona",             ja: "ウルガモス",              id: 637   },
  { name: "toxapex",               ja: "ドヒドイデ",              id: 748   },
  { name: "slowking-galar",        ja: "ガラルヤドキング",        id: 10172 },
  { name: "clefable",              ja: "ピクシー",                id: 36    },
  { name: "blissey",               ja: "ハピナス",                id: 242   },
  { name: "gardevoir",             ja: "サーナイト",              id: 282   },
  { name: "palafin-hero",          ja: "イルカマン（英雄）",      id: 10256 },
  { name: "tornadus-therian",      ja: "トルネロス（霊獣）",      id: 10019 },
  { name: "pelipper",              ja: "ペリッパー",              id: 279   },
];
