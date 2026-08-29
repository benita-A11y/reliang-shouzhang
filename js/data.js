/* ============================================================
 * 热量手账 · 品牌/店铺/规格数据
 * 奶茶咖啡品牌 TOP 热销单品 + 食品店铺（品类导航）+ 规格选择库
 * kcal = 中杯 · 默认糖（5分）基准值，price = 中杯基准价
 * ============================================================ */
'use strict';

/* ---------- 规格库 ---------- */
const DRINK_SPECS = {
  sweetness: [
    { label: '无糖', deltaKcal: -36, deltaPrice: 0 },
    { label: '3分糖', deltaKcal: -18, deltaPrice: 0 },
    { label: '5分糖', deltaKcal: 0, deltaPrice: 0 },
    { label: '7分糖', deltaKcal: 18, deltaPrice: 0 },
    { label: '全糖', deltaKcal: 36, deltaPrice: 0 }
  ],
  temperature: [
    { label: '冰', coef: 1, note: '' },
    { label: '常温', coef: 1, note: '' },
    { label: '热', coef: 1, note: '' }
  ],
  sizes: [
    { label: '中杯', coef: 1.0, priceCoef: 1.0 },
    { label: '大杯', coef: 1.2, priceCoef: 1.2 }
  ],
  toppings: [
    { name: '珍珠', kcal: 50, price: 2 },
    { name: '椰果', kcal: 20, price: 1 },
    { name: '芋泥', kcal: 60, price: 3 },
    { name: '奶盖', kcal: 80, price: 4 },
    { name: '波霸', kcal: 45, price: 2 },
    { name: '布丁', kcal: 80, price: 3 },
    { name: '红豆', kcal: 55, price: 2 },
    { name: '燕麦', kcal: 45, price: 3 }
  ]
};

const FOOD_SPECS = {
  portions: [
    { label: '小份', coef: 0.8, priceCoef: 0.85 },
    { label: '中份', coef: 1.0, priceCoef: 1.0 },
    { label: '大份', coef: 1.2, priceCoef: 1.2 }
  ],
  spices: [
    { label: '不辣', deltaKcal: 0 },
    { label: '微辣', deltaKcal: 5 },
    { label: '中辣', deltaKcal: 10 },
    { label: '特辣', deltaKcal: 15 }
  ]
};

/* ---------- 奶茶/咖啡品牌（drink 品类） ---------- */
const BRANDS = [
  {
    id: 'mixue', name: '蜜雪冰城', emoji: '🍦', color: '#E63329', flavor: '甜口',
    items: [
      { name: '冰鲜柠檬水', series: '果茶', kcal: 170, price: 4 },
      { name: '珍珠奶茶', series: '奶茶', kcal: 380, price: 8 },
      { name: '摇摇奶昔（草莓）', series: '奶茶', kcal: 320, price: 8 },
      { name: '满杯百香果', series: '果茶', kcal: 240, price: 8 },
      { name: '杨枝甘露', series: '奶茶', kcal: 330, price: 12 },
      { name: '原味冰淇淋', series: '甜品', kcal: 180, price: 3 },
      { name: '圣代（巧克力）', series: '甜品', kcal: 290, price: 6 },
      { name: '冰淇淋红茶', series: '果茶', kcal: 220, price: 7 },
      { name: '芝士奶盖四季春', series: '奶茶', kcal: 260, price: 10 },
      { name: '桃桃摇摇奶昔', series: '奶茶', kcal: 340, price: 8 },
      { name: '柠檬绿茶', series: '果茶', kcal: 150, price: 5 },
      { name: '草莓圣代', series: '甜品', kcal: 270, price: 6 },
      { name: '冰摇柠檬茶', series: '果茶', kcal: 190, price: 6 },
      { name: '芝士奶盖绿茶', series: '奶茶', kcal: 280, price: 10 },
      { name: '珍珠圣代', series: '甜品', kcal: 310, price: 7 }
    ]
  },
  {
    id: 'guming', name: '古茗', emoji: '🍇', color: '#2C3E50', flavor: '甜口',
    items: [
      { name: '超A芝士葡萄', series: '果茶', kcal: 380, price: 18 },
      { name: '杨枝甘露椰奶', series: '奶茶', kcal: 420, price: 17 },
      { name: '大叔奶茶', series: '奶茶', kcal: 350, price: 13 },
      { name: '满杯金菠萝', series: '果茶', kcal: 300, price: 16 },
      { name: '云雾栀子青', series: '纯茶', kcal: 180, price: 13 },
      { name: '茉莉奶绿', series: '奶茶', kcal: 290, price: 12 },
      { name: '椰椰啵啵', series: '奶茶', kcal: 310, price: 15 },
      { name: '草莓椰奶', series: '奶茶', kcal: 340, price: 16 },
      { name: '芝士奶盖乌龙', series: '奶茶', kcal: 330, price: 15 },
      { name: '多肉葡萄', series: '果茶', kcal: 360, price: 18 },
      { name: '生椰抹茶', series: '奶茶', kcal: 300, price: 16 },
      { name: '酒酿芋圆', series: '季节限定', kcal: 370, price: 15 },
      { name: '芝士茉莉', series: '奶茶', kcal: 290, price: 15 },
      { name: '满杯百香果', series: '果茶', kcal: 280, price: 15 },
      { name: '椰椰芒芒', series: '果茶', kcal: 290, price: 16 }
    ]
  },
  {
    id: 'yidiandian', name: '一点点', emoji: '🧋', color: '#A6B4C4', flavor: '甜口',
    items: [
      { name: '波霸奶茶', series: '奶茶', kcal: 390, price: 11 },
      { name: '四季春茶', series: '纯茶', kcal: 120, price: 9 },
      { name: '乌龙奶茶', series: '奶茶', kcal: 320, price: 12 },
      { name: '阿华田', series: '奶茶', kcal: 380, price: 13 },
      { name: '冰淇淋红茶', series: '果茶', kcal: 250, price: 12 },
      { name: '养乐多绿', series: '果茶', kcal: 200, price: 13 },
      { name: '仙草冻奶茶', series: '奶茶', kcal: 310, price: 12 },
      { name: '柠檬养乐多', series: '果茶', kcal: 180, price: 12 },
      { name: '可可芭蕾', series: '奶茶', kcal: 400, price: 14 },
      { name: '纯抹茶', series: '奶茶', kcal: 230, price: 14 },
      { name: '古早味奶绿', series: '奶茶', kcal: 280, price: 11 },
      { name: '百香三重奏', series: '果茶', kcal: 260, price: 14 },
      { name: '珍珠奶绿', series: '奶茶', kcal: 300, price: 11 },
      { name: '芒果青', series: '果茶', kcal: 210, price: 13 },
      { name: '奶茶三兄弟', series: '奶茶', kcal: 390, price: 13 }
    ]
  },
  {
    id: 'coco', name: 'CoCo都可', emoji: '🧉', color: '#8B5A2B', flavor: '甜口',
    items: [
      { name: '珍珠奶茶', series: '奶茶', kcal: 370, price: 10 },
      { name: '鲜百香双响炮', series: '果茶', kcal: 260, price: 14 },
      { name: '奶茶三兄弟', series: '奶茶', kcal: 400, price: 13 },
      { name: '柠檬红茶', series: '果茶', kcal: 160, price: 11 },
      { name: '青稞奶茶', series: '奶茶', kcal: 340, price: 13 },
      { name: '鲜芋青稞牛奶', series: '奶茶', kcal: 360, price: 15 },
      { name: '芒果欧蕾', series: '奶茶', kcal: 300, price: 14 },
      { name: '布丁奶茶', series: '奶茶', kcal: 350, price: 12 },
      { name: '双拼奶茶', series: '奶茶', kcal: 380, price: 12 },
      { name: '鲜醇芋泥牛奶', series: '奶茶', kcal: 340, price: 16 },
      { name: '蜜雪柠香', series: '果茶', kcal: 170, price: 10 },
      { name: '草莓厚乳', series: '季节限定', kcal: 320, price: 16 },
      { name: '鲜芋牛奶西米露', series: '奶茶', kcal: 320, price: 15 },
      { name: '柠檬椰果养乐多', series: '果茶', kcal: 210, price: 14 },
      { name: '红豆奶茶', series: '奶茶', kcal: 330, price: 12 }
    ]
  },
  {
    id: 'chagee', name: '霸王茶姬', emoji: '🍵', color: '#1B3A2F', flavor: '清淡',
    items: [
      { name: '伯牙绝弦', series: '奶茶', kcal: 260, price: 18 },
      { name: '桂馥兰香', series: '纯茶', kcal: 150, price: 15 },
      { name: '寻香山茶', series: '奶茶', kcal: 270, price: 18 },
      { name: '青青糯山', series: '奶茶', kcal: 290, price: 17 },
      { name: '万山红金丝小种', series: '纯茶', kcal: 140, price: 16 },
      { name: '白雾红尘', series: '奶茶', kcal: 250, price: 18 },
      { name: '春宴樱花乌龙', series: '季节限定', kcal: 240, price: 17 },
      { name: '醒时春山', series: '奶茶', kcal: 230, price: 17 },
      { name: '花田乌龙', series: '奶茶', kcal: 260, price: 18 },
      { name: '云栖玫瑰', series: '奶茶', kcal: 280, price: 19 },
      { name: '天香茉莉', series: '纯茶', kcal: 130, price: 15 },
      { name: '桂子飘香', series: '季节限定', kcal: 250, price: 18 },
      { name: '幽幽乌龙', series: '纯茶', kcal: 120, price: 15 },
      { name: '破沫云峰', series: '纯茶', kcal: 150, price: 16 },
      { name: '桂花米酿', series: '季节限定', kcal: 240, price: 18 }
    ]
  },
  {
    id: 'heytea', name: '喜茶', emoji: '🍑', color: '#7A3B2E', flavor: '甜口',
    items: [
      { name: '多肉葡萄', series: '果茶', kcal: 350, price: 29 },
      { name: '多肉桃李', series: '果茶', kcal: 320, price: 29 },
      { name: '烤黑糖波波牛乳', series: '奶茶', kcal: 420, price: 25 },
      { name: '芝芝莓莓', series: '果茶', kcal: 340, price: 29 },
      { name: '椰椰芒芒', series: '果茶', kcal: 300, price: 27 },
      { name: '满杯红柚', series: '果茶', kcal: 240, price: 26 },
      { name: '芝芝芒芒', series: '果茶', kcal: 330, price: 29 },
      { name: '生打椰椰奶冻', series: '奶茶', kcal: 350, price: 25 },
      { name: '轻芝多肉葡萄', series: '果茶', kcal: 280, price: 29 },
      { name: '纯绿妍茶后', series: '纯茶', kcal: 120, price: 15 },
      { name: '烤布蕾波波', series: '奶茶', kcal: 400, price: 25 },
      { name: '手剥龙眼冰', series: '季节限定', kcal: 310, price: 28 },
      { name: '满杯西柚', series: '果茶', kcal: 230, price: 25 },
      { name: '芝芝莓莓桃', series: '果茶', kcal: 340, price: 30 },
      { name: '烤黑糖波波鲜奶', series: '奶茶', kcal: 430, price: 26 }
    ]
  },
  {
    id: 'naixue', name: '奈雪的茶', emoji: '🍓', color: '#4A2C2A', flavor: '甜口',
    items: [
      { name: '霸气芝士葡萄', series: '果茶', kcal: 360, price: 27 },
      { name: '霸气草莓', series: '果茶', kcal: 300, price: 27 },
      { name: '霸气橙子', series: '果茶', kcal: 240, price: 25 },
      { name: '杨枝甘露', series: '奶茶', kcal: 380, price: 26 },
      { name: '鸭屎香宝藏茶', series: '奶茶', kcal: 340, price: 24 },
      { name: '金色山脉宝藏茶', series: '奶茶', kcal: 360, price: 24 },
      { name: '霸气芝士芒果', series: '果茶', kcal: 330, price: 28 },
      { name: '奈雪初露', series: '纯茶', kcal: 130, price: 15 },
      { name: '冰博克厚乳', series: '奶茶', kcal: 350, price: 26 },
      { name: '霸气芝士桃桃', series: '果茶', kcal: 320, price: 28 },
      { name: '抹茶芋泥宝藏茶', series: '季节限定', kcal: 390, price: 26 },
      { name: '草莓魔法棒奶茶', series: '季节限定', kcal: 370, price: 25 },
      { name: '霸气葡萄', series: '果茶', kcal: 330, price: 27 },
      { name: '霸气芝士草莓', series: '果茶', kcal: 310, price: 28 },
      { name: '冷泡茶系列', series: '纯茶', kcal: 20, price: 12 }
    ]
  },
  {
    id: 'luckin', name: '瑞幸咖啡', emoji: '☕', color: '#1B4B8F', flavor: '清淡',
    items: [
      { name: '生椰拿铁', series: '咖啡', kcal: 300, price: 16 },
      { name: '厚乳拿铁', series: '咖啡', kcal: 330, price: 18 },
      { name: '丝绒拿铁', series: '咖啡', kcal: 320, price: 17 },
      { name: '生酪拿铁', series: '咖啡', kcal: 340, price: 18 },
      { name: '标准美式', series: '咖啡', kcal: 10, price: 13 },
      { name: '拿铁', series: '咖啡', kcal: 180, price: 15 },
      { name: '卡布奇诺', series: '咖啡', kcal: 160, price: 15 },
      { name: '焦糖玛奇朵', series: '咖啡', kcal: 240, price: 17 },
      { name: '橙C美式', series: '咖啡', kcal: 120, price: 16 },
      { name: '茉莉花香拿铁', series: '咖啡', kcal: 210, price: 17 },
      { name: '抹茶瑞纳冰', series: '咖啡', kcal: 360, price: 20 },
      { name: '陨石拿铁', series: '咖啡', kcal: 340, price: 19 },
      { name: '生椰丝绒拿铁', series: '咖啡', kcal: 300, price: 17 },
      { name: '冰吸生椰拿铁', series: '咖啡', kcal: 310, price: 18 },
      { name: '橙香美式', series: '咖啡', kcal: 90, price: 15 }
    ]
  },
  {
    id: 'cotti', name: '库迪咖啡', emoji: '🧊', color: '#C8102E', flavor: '清淡',
    items: [
      { name: '生椰拿铁', series: '咖啡', kcal: 290, price: 9.9 },
      { name: '潘帕斯蓝生酪茉莉拿铁', series: '咖啡', kcal: 320, price: 12.9 },
      { name: '星辰厚乳拿铁', series: '咖啡', kcal: 340, price: 12.9 },
      { name: '阿根廷芝士拿铁', series: '咖啡', kcal: 330, price: 12.9 },
      { name: '库可冰（摩卡）', series: '咖啡', kcal: 310, price: 11.9 },
      { name: '燕麦拿铁', series: '咖啡', kcal: 260, price: 13.9 },
      { name: '拿铁', series: '咖啡', kcal: 170, price: 9.9 },
      { name: '美式', series: '咖啡', kcal: 10, price: 8.9 },
      { name: '摩卡', series: '咖啡', kcal: 250, price: 11.9 },
      { name: '焦糖拿铁', series: '咖啡', kcal: 230, price: 11.9 },
      { name: '库迪冰萃咖啡', series: '咖啡', kcal: 30, price: 9.9 },
      { name: '柚C美式', series: '季节限定', kcal: 130, price: 10.9 },
      { name: '生椰丝绒拿铁', series: '咖啡', kcal: 280, price: 11.9 },
      { name: '轻乳酪拿铁', series: '咖啡', kcal: 290, price: 12.9 },
      { name: '桂花酿拿铁', series: '季节限定', kcal: 250, price: 12.9 }
    ]
  }
];

/* ---------- 食品店铺（按品类找） ---------- */
const SHOPS = [
  { id: 'mcd', name: '麦当劳', emoji: '🍔', cat: '汉堡炸鸡', flavor: '咸香', color: '#F5A300', items: [
    { name: '麦辣鸡腿堡', kcal: 490, price: 21 },
    { name: '板烧鸡腿堡', kcal: 420, price: 21 },
    { name: '巨无霸', kcal: 550, price: 26 },
    { name: '薯条（中）', kcal: 320, price: 12 },
    { name: '麦辣鸡翅（对）', kcal: 280, price: 12.5 }
  ]},
  { id: 'kfc', name: '肯德基', emoji: '🍟', cat: '汉堡炸鸡', flavor: '咸香', color: '#A40000', items: [
    { name: '香辣鸡腿堡', kcal: 560, price: 22 },
    { name: '原味鸡（块）', kcal: 270, price: 12 },
    { name: '老北京鸡肉卷', kcal: 480, price: 20 },
    { name: '薯条（中）', kcal: 320, price: 11 },
    { name: '蛋挞（只）', kcal: 200, price: 7 }
  ]},
  { id: 'hls', name: '华莱士', emoji: '🍗', cat: '汉堡炸鸡', flavor: '咸香', color: '#E63329', items: [
    { name: '香辣鸡腿堡', kcal: 480, price: 10 },
    { name: '脆皮全鸡', kcal: 1400, price: 28 },
    { name: '鸡米花（中）', kcal: 380, price: 9 },
    { name: '薯条（中）', kcal: 300, price: 8 }
  ]},
  { id: 'zl', name: '张亮麻辣烫', emoji: '🌶️', cat: '麻辣烫', flavor: '辣', color: '#D32F2F', items: [
    { name: '麻辣烫（素）', kcal: 350, price: 15 },
    { name: '麻辣烫（荤）', kcal: 550, price: 24 },
    { name: '麻辣拌', kcal: 500, price: 22 },
    { name: '骨汤清汤烫', kcal: 380, price: 18 }
  ]},
  { id: 'ygf', name: '杨国福', emoji: '🍲', cat: '麻辣烫', flavor: '辣', color: '#B02A30', items: [
    { name: '经典麻辣烫', kcal: 450, price: 20 },
    { name: '骨汤麻辣烫', kcal: 400, price: 20 },
    { name: '麻辣拌（荤）', kcal: 520, price: 24 }
  ]},
  { id: 'shaxian', name: '沙县小吃', emoji: '🍜', cat: '粉面', flavor: '咸香', color: '#2E7D32', items: [
    { name: '拌面', kcal: 450, price: 8 },
    { name: '蒸饺（笼）', kcal: 320, price: 8 },
    { name: '飘香馄饨', kcal: 300, price: 10 },
    { name: '鸡腿饭', kcal: 620, price: 16 }
  ]},
  { id: 'lanzhou', name: '兰州拉面', emoji: '🍝', cat: '粉面', flavor: '咸香', color: '#B08D57', items: [
    { name: '牛肉拉面', kcal: 520, price: 13 },
    { name: '西红柿鸡蛋面', kcal: 430, price: 12 },
    { name: '牛肉炒面', kcal: 650, price: 18 },
    { name: '兰州牛肉面（毛细）', kcal: 500, price: 13 }
  ]},
  { id: 'laoxiangji', name: '老乡鸡', emoji: '🐔', cat: '米饭套餐', flavor: '清淡', color: '#B53B2A', items: [
    { name: '鸡汤饭套餐', kcal: 480, price: 22 },
    { name: '肥西老母鸡汤', kcal: 210, price: 15 },
    { name: '青椒炒肉饭', kcal: 620, price: 20 },
    { name: '小炒肉饭', kcal: 640, price: 20 },
    { name: '白切鸡饭', kcal: 550, price: 22 }
  ]},
  { id: 'xiangcunji', name: '乡村基', emoji: '🍚', cat: '米饭套餐', flavor: '咸香', color: '#C62828', items: [
    { name: '宫保鸡丁饭', kcal: 580, price: 16 },
    { name: '鱼香肉丝饭', kcal: 590, price: 16 },
    { name: '酸菜鱼饭', kcal: 610, price: 19 },
    { name: '番茄炒蛋饭', kcal: 460, price: 14 }
  ]},
  { id: 'shaye', name: '沙野轻食', emoji: '🥗', cat: '轻食沙拉', flavor: '清淡', color: '#4CAF50', items: [
    { name: '鸡胸肉沙拉', kcal: 330, price: 23 },
    { name: '牛油果藜麦碗', kcal: 420, price: 28 },
    { name: '虾仁糙米碗', kcal: 380, price: 26 },
    { name: '全麦三明治', kcal: 300, price: 15 }
  ]},
  { id: 'superzhan', name: '超能鹿战队', emoji: '🥦', cat: '轻食沙拉', flavor: '清淡', color: '#2E7D32', items: [
    { name: '低脂鸡胸能量碗', kcal: 350, price: 24 },
    { name: '金枪鱼沙拉', kcal: 300, price: 26 },
    { name: '蛋白双拼碗', kcal: 400, price: 27 }
  ]},
  { id: 'bali', name: '巴黎贝甜', emoji: '🍰', cat: '甜品面包', flavor: '甜口', color: '#8E6FAE', items: [
    { name: '奶油泡芙（个）', kcal: 180, price: 9 },
    { name: '芝士蛋糕', kcal: 320, price: 18 },
    { name: '牛角包', kcal: 260, price: 12 },
    { name: '提拉米苏', kcal: 380, price: 22 }
  ]},
  { id: '85c', name: '85度C', emoji: '🍞', cat: '甜品面包', flavor: '甜口', color: '#5D4037', items: [
    { name: '凯撒大帝', kcal: 420, price: 15 },
    { name: '海盐芝士欧包', kcal: 350, price: 14 },
    { name: '半熟芝士', kcal: 280, price: 16 },
    { name: '奶香片', kcal: 220, price: 10 }
  ]}
];

/* ---------- 品类导航 ---------- */
const FOOD_CATEGORIES = [
  { name: '奶茶咖啡', emoji: '🧋' },
  { name: '汉堡炸鸡', emoji: '🍔' },
  { name: '麻辣烫', emoji: '🌶️' },
  { name: '粉面', emoji: '🍜' },
  { name: '米饭套餐', emoji: '🍚' },
  { name: '轻食沙拉', emoji: '🥗' },
  { name: '甜品面包', emoji: '🍰' }
];

/* ---------- 店铺热度（评分 + 月售，平台热度展示用） ---------- */
const SHOP_HOTNESS = {
  mixue: { rating: 4.8, sales: '月售 8.6w+' },
  guming: { rating: 4.9, sales: '月售 6.2w+' },
  yidiandian: { rating: 4.7, sales: '月售 5.1w+' },
  coco: { rating: 4.6, sales: '月售 4.8w+' },
  chagee: { rating: 4.9, sales: '月售 7.5w+' },
  heytea: { rating: 4.8, sales: '月售 5.6w+' },
  naixue: { rating: 4.7, sales: '月售 4.2w+' },
  luckin: { rating: 4.8, sales: '月售 12w+' },
  cotti: { rating: 4.6, sales: '月售 9.3w+' },
  mcd: { rating: 4.8, sales: '月售 15w+' },
  kfc: { rating: 4.7, sales: '月售 13w+' },
  hls: { rating: 4.5, sales: '月售 18w+' },
  zl: { rating: 4.6, sales: '月售 7.8w+' },
  ygf: { rating: 4.7, sales: '月售 8.1w+' },
  shaxian: { rating: 4.4, sales: '月售 16w+' },
  lanzhou: { rating: 4.5, sales: '月售 9.4w+' },
  laoxiangji: { rating: 4.8, sales: '月售 6.9w+' },
  xiangcunji: { rating: 4.6, sales: '月售 5.4w+' },
  shaye: { rating: 4.7, sales: '月售 3.2w+' },
  superzhan: { rating: 4.6, sales: '月售 2.7w+' },
  bali: { rating: 4.7, sales: '月售 4.1w+' },
  '85c': { rating: 4.6, sales: '月售 3.8w+' }
};
const shopHotness = (id) => SHOP_HOTNESS[id] || { rating: 4.5, sales: '月售 1w+' };

/* ---------- 平台校准数据（演示“有更新”角标） ---------- */
const PLATFORM_CALIBRATIONS = {
  '生椰拿铁（瑞幸）': { kcal: 285, source: '瑞幸2026年官方营养表' },
  '珍珠奶茶（蜜雪）': { kcal: 375, source: '蜜雪冰城2026年官方营养表' },
  '食堂炒饭': { kcal: 600, source: '平台众包校准' },
  '黄焖鸡米饭': { kcal: 655, source: '平台众包校准' }
};

/* ---------- 工具：根据名称关键词推测系列（AI 自动归类兜底） ---------- */
function guessSeries(name) {
  const n = String(name || '');
  if (!n) return '其他';
  // 饮品
  if (/拿铁|美式|咖啡|摩卡|玛奇朵|瑞纳冰|卡布奇诺/.test(n)) return '咖啡';
  if (/芝士|奶茶|波波|奶绿|欧蕾|鲜芋|奶盖|宝藏|奶昔|厚乳/.test(n)) return '奶茶';
  if (/柠檬|百香|葡萄|草莓|芒果|桃|柚|橙|西瓜|龙眼/.test(n)) return '果茶';
  if (/限定|樱花|酒酿/.test(n)) return '季节限定';
  if (/纯茶|四季春|乌龙|红茶|绿茶|茉莉/.test(n)) return '纯茶';
  // 顺序有讲究：「面包」含「面」，烘焙必须在面食之前判
  if (/面包|蛋糕|甜点|泡芙|蛋挞|吐司|欧包|可颂|曲奇/.test(n)) return '烘焙甜点';
  if (/汉堡|炸鸡|鸡腿堡|鸡翅|薯条|鸡块|鸡米花/.test(n)) return '汉堡炸鸡';
  if (/麻辣烫|冒菜|香锅|钵钵|串串|麻辣拌/.test(n)) return '麻辣烫冒菜';
  if (/饭|盖饭|盖码|煲仔|便当|套餐|黄焖|拌饭/.test(n)) return '米饭套餐';
  if (/面|粉|米线|馄饨|饺子|包子|抄手|水饺|蒸饺|煎饺|小笼|汤包|烧麦/.test(n)) return '面食粉类';
  if (/沙拉|轻食|藜麦|糙米|能量碗/.test(n)) return '轻食沙拉';
  if (/粥|汤|豆浆|豆腐脑/.test(n)) return '汤粥';
  if (/烧烤|烤串|烤肉|铁板|烤鱼/.test(n)) return '烧烤';
  if (/水果|苹果|香蕉|橘子|橙子|葡萄|西瓜|莓/.test(n)) return '水果';
  if (/坚果|瓜子|薯片|饼干|巧克力|糖果|辣条/.test(n)) return '零食';
  return '其他';
}

/* ---------- 自动生成搜索关键词：录入时一次打标，后期搜索「珍珠」「拿铁」都能命中 ---------- */
const KEYWORD_TRAITS = [
  // 饮品小料 / 口味
  '珍珠', '椰果', '布丁', '芋圆', '燕麦', '奶盖', '芝士', '波波',
  '拿铁', '美式', '摩卡', '咖啡', '奶茶', '果茶', '纯茶', '奶昔',
  // 主要食材
  '鸡胸', '牛肉', '猪肉', '羊肉', '鸡腿', '鸡翅', '鸡排', '虾', '鱼', '豆腐', '鸡蛋',
  '蔬菜', '菠菜', '生菜', '西兰花', '土豆', '番茄', '玉米', '南瓜',
  '藜麦', '糙米', '全麦', '荞麦', '燕麦',
  // 主食形态
  '米饭', '炒饭', '盖饭', '面条', '拉面', '炒面', '米粉', '米线', '馄饨', '饺子', '包子', '粥',
  '汉堡', '炸鸡', '薯条', '披萨', '三明治', '面包', '蛋糕',
  // 口味 / 属性
  '麻辣', '香辣', '微辣', '中辣', '特辣', '不辣', '清淡', '低脂', '减脂', '高蛋白', '轻食', '沙拉'
];
function extractKeywords(o) {
  const src = o || {};
  const set = new Set();
  const add = (v) => { const s = String(v == null ? '' : v).trim(); if (s) set.add(s); };
  // 一级：直接可搜的字段
  add(src.name); add(src.shop); add(src.brand); add(src.series); add(src.category);
  // 二级：从名称里抽特征词（搜「珍珠」能找到「珍珠奶茶」）
  const n = String(src.name || '');
  for (const t of KEYWORD_TRAITS) if (n.includes(t)) add(t);
  // 三级：规格也进关键词（搜「全糖」「冰」能命中）
  const sp = src.spec || {};
  [sp.sweetness, sp.temp, sp.size, sp.portion, sp.spice].forEach(add);
  (sp.toppings || []).forEach(add);
  return Array.from(set);
}

/* 相似度（简单字符重合度）用于名称消歧 */
function nameSimilarity(a, b) {
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  let hit = 0;
  setA.forEach((c) => { if (setB.has(c)) hit++; });
  return hit / Math.max(setA.size, setB.size);
}
/* 中文字符 → 拼音（无声调），用于搜索的拼音匹配；由脚本生成，覆盖平台数据与常见饮食用字 */
const PINYIN_MAP = {"一":"yi","丁":"ding","万":"wan","三":"san","不":"bu","东":"dong","丝":"si","个":"ge","中":"zhong","串":"chuan","丸":"wan","丼":"jing","乌":"wu","乐":"le","乡":"xiang","乳":"ru","于":"yu","云":"yun","五":"wu","京":"jing","亮":"liang","亲":"qin","仁":"ren","仔":"zai","他":"ta","仙":"xian","代":"dai","价":"jia","份":"fen","众":"zhong","伯":"bo","似":"si","低":"di","便":"bian","保":"bao","值":"zhi","兄":"xiong","克":"ke","兜":"dou","全":"quan","八":"ba","兰":"lan","关":"guan","其":"qi","具":"ju","典":"dian","养":"yang","冒":"mao","冬":"dong","冰":"bing","冷":"leng","冻":"dong","准":"zhun","凉":"liang","凯":"kai","刀":"dao","分":"fen","切":"qie","列":"lie","初":"chu","刺":"ci","削":"xiao","剥":"bao","力":"li","功":"gong","动":"dong","助":"zhu","劳":"lao","包":"bao","北":"bei","千":"qian","半":"ban","华":"hua","单":"dan","卖":"mai","博":"bo","卡":"ka","卷":"juan","厚":"hou","原":"yuan","县":"xian","参":"can","双":"shuang","叔":"shu","口":"kou","古":"gu","只":"zhi","可":"ke","台":"tai","叶":"ye","司":"si","吃":"chi","合":"he","名":"ming","后":"hou","吸":"xi","味":"wei","咖":"ka","咸":"xian","品":"pin","响":"xiang","售":"shou","啡":"fei","啤":"pi","啵":"bo","喜":"xi","喱":"li","四":"si","团":"tuan","国":"guo","圆":"yuan","土":"tu","圣":"sheng","块":"kuai","坚":"jian","城":"cheng","培":"pei","基":"ji","堂":"tang","堡":"bao","士":"shi","外":"wai","多":"duo","大":"da","天":"tian","奇":"qi","奈":"nai","奏":"zou","套":"tao","奶":"nai","妇":"fu","妍":"yan","姬":"ji","子":"zi","字":"zi","孜":"zi","季":"ji","官":"guan","定":"ding","宝":"bao","宫":"gong","宴":"yan","对":"dui","寻":"xun","导":"dao","寿":"shou","小":"xiao","尘":"chen","尾":"wei","屎":"shi","展":"zhan","山":"shan","岛":"dao","峰":"feng","州":"zhou","工":"gong","巧":"qiao","巨":"ju","巴":"ba","布":"bu","帕":"pa","帝":"di","带":"dai","常":"chang","干":"gan","平":"ping","年":"nian","幸":"xing","幽":"you","库":"ku","底":"di","店":"dian","度":"du","廷":"ting","式":"shi","弟":"di","张":"zhang","弦":"xian","归":"gui","当":"dang","御":"yu","微":"wei","德":"de","慕":"mu","战":"zhan","扇":"shan","手":"shou","打":"da","找":"zhao","抹":"mo","担":"dan","拉":"la","拌":"ban","择":"ze","拼":"pin","拿":"na","按":"an","挞":"ta","据":"ju","推":"tui","提":"ti","摇":"yao","摩":"mo","撒":"sa","数":"shu","文":"wen","斯":"si","新":"xin","方":"fang","无":"wu","早":"zao","时":"shi","明":"ming","昔":"xi","星":"xing","春":"chun","普":"pu","曲":"qu","更":"geng","月":"yue","有":"you","木":"mu","末":"mo","朵":"duo","李":"li","杏":"xing","村":"cun","条":"tiao","杨":"yang","杯":"bei","板":"ban","果":"guo","枝":"zhi","枪":"qiang","柚":"you","柠":"ning","柿":"shi","栀":"zhi","标":"biao","栖":"qi","校":"xiao","根":"gen","格":"ge","桂":"gui","桃":"tao","桥":"qiao","棒":"bang","椒":"jiao","椰":"ye","榴":"liu","樱":"ying","橘":"ju","橙":"cheng","檬":"meng","欧":"ou","歧":"qi","母":"mu","毛":"mao","气":"qi","水":"shui","汉":"han","汤":"tang","沌":"dun","沙":"sha","沫":"mo","河":"he","油":"you","治":"zhi","泉":"quan","法":"fa","泡":"pao","波":"bo","泥":"ni","浆":"jiang","浇":"jiao","测":"ce","海":"hai","消":"xiao","淀":"dian","淇":"qi","淋":"lin","淡":"dan","混":"hun","清":"qing","温":"wen","满":"man","演":"yan","潘":"pan","灌":"guan","炒":"chao","炮":"pao","炸":"zha","点":"dian","炼":"lian","烤":"kao","烧":"shao","烫":"tang","热":"re","焖":"men","焦":"jiao","然":"ran","煎":"jian","照":"zhao","煮":"zhu","煲":"bao","熟":"shu","燕":"yan","片":"pian","牌":"pai","牙":"ya","牛":"niu","特":"te","猕":"mi","猪":"zhu","猴":"hou","玉":"yu","王":"wang","玛":"ma","玫":"mei","珍":"zhen","珠":"zhu","瑞":"rui","瑰":"gui","瓜":"gua","甘":"gan","甜":"tian","生":"sheng","用":"yong","田":"tian","番":"fan","白":"bai","百":"bai","的":"de","皮":"pi","盐":"yan","盒":"he","盖":"gai","相":"xiang","眼":"yan","石":"shi","矿":"kuang","码":"ma","破":"po","碗":"wan","碧":"bi","示":"shi","福":"fu","种":"zhong","称":"cheng","稞":"ke","章":"zhang","竹":"zhu","符":"fu","笼":"long","筒":"tong","简":"jian","米":"mi","类":"lei","粉":"fen","粥":"zhou","精":"jing","糕":"gao","糖":"tang","糙":"cao","糯":"nuo","系":"xi","素":"su","红":"hong","纯":"chun","纳":"na","线":"xian","细":"xi","经":"jing","绒":"rong","绝":"jue","绿":"lü","罗":"luo","羊":"yang","美":"mei","翅":"chi","老":"lao","肉":"rou","肚":"du","肠":"chang","肥":"fei","肯":"ken","胸":"xiong","能":"neng","脂":"zhi","脆":"cui","脉":"mai","腊":"la","腐":"fu","腿":"tui","臊":"sao","自":"zi","航":"hang","色":"se","节":"jie","芋":"yu","芒":"mang","芙":"fu","芝":"zhi","芥":"jie","芬":"fen","芭":"ba","花":"hua","芹":"qin","苏":"su","苹":"ping","茄":"qie","茉":"mo","茗":"ming","茴":"hui","茶":"cha","草":"cao","荔":"li","荞":"qiao","荤":"hun","莉":"li","莓":"mei","莱":"lai","莲":"lian","菇":"gu","菜":"cai","菠":"bo","萃":"cui","萄":"tao","萝":"luo","营":"ying","葡":"pu","蒜":"suan","蒲":"pu","蒸":"zheng","蓉":"rong","蓝":"lan","蔬":"shu","蕉":"jiao","蕾":"lei","薯":"shu","藏":"cang","藜":"li","虾":"xia","蛋":"dan","蛤":"ha","蛳":"si","蜂":"feng","蜜":"mi","螺":"luo","蟹":"xie","表":"biao","西":"xi","规":"gui","角":"jiao","认":"ren","评":"ping","词":"ci","诺":"nuo","豆":"dou","贝":"bei","账":"zhang","贴":"tie","超":"chao","身":"shen","轻":"qing","辣":"la","辰":"chen","达":"da","过":"guo","迪":"di","选":"xuan","都":"dou","酒":"jiu","酪":"lao","酱":"jiang","酸":"suan","酿":"niang","醇":"chun","醋":"cu","醒":"xing","重":"zhong","野":"ye","量":"liang","金":"jin","针":"zhen","钵":"bo","铁":"tie","铺":"pu","销":"xiao","锅":"guo","键":"jian","队":"dui","阳":"yang","阴":"yin","阿":"a","限":"xian","陨":"yun","雪":"xue","零":"ling","雾":"wu","露":"lu","霸":"ba","青":"qing","面":"mian","韭":"jiu","飘":"piao","食":"shi","餐":"can","饨":"tun","饭":"fan","饮":"yin","饵":"er","饺":"jiao","饼":"bing","馄":"hun","馅":"xian","馍":"mo","香":"xiang","馥":"fu","马":"ma","骨":"gu","魔":"mo","鱼":"yu","鲈":"lu","鲍":"bao","鲜":"xian","鲤":"li","鲫":"ji","鲳":"chang","鳕":"xue","鳗":"man","鳝":"shan","鸡":"ji","鸭":"ya","鹿":"lu","麦":"mai","麻":"ma","黄":"huang","黎":"li","黑":"hei","默":"mo","龙":"long"};


/* ---------- 拼音（搜索用）：字符串 → 全拼 / 首字母 ---------- */
function pinyinOf(str) {
  let out = '';
  for (const ch of String(str || '')) {
    if (/[\u4e00-\u9fa5]/.test(ch)) out += (PINYIN_MAP && PINYIN_MAP[ch]) || '';
    else out += ch.toLowerCase();
  }
  return out;
}
function pyInitials(str) {
  let out = '';
  for (const ch of String(str || '')) {
    if (/[\u4e00-\u9fa5]/.test(ch)) { const p = PINYIN_MAP && PINYIN_MAP[ch]; if (p) { out += p[0]; continue; } }
    else out += ch.toLowerCase();
  }
  return out;
}

/* ---------- 编辑距离（Levenshtein），店铺名模糊匹配 ---------- */
function editDistance(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/* ---------- 搜索匹配：中文子串 / 全拼 / 拼音首字母，任一命中即匹配 ---------- */
function textMatch(text, q) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return true;
  const t = String(text || '');
  if (t.toLowerCase().includes(query)) return true;
  if (/^[a-z0-9\s]+$/.test(query)) {
    if (pinyinOf(t).includes(query.replace(/\s/g, ''))) return true;
    if (pyInitials(t).includes(query.replace(/\s/g, ''))) return true;
  }
  return false;
}

/* ---------- 高亮：中文直命中标区间；拼音命中反查对应汉字整段高亮 ---------- */
function highlightMatch(text, q) {
  const t = String(text || '');
  const query = String(q || '').trim().toLowerCase();
  if (!query) return esc(t);
  const idx = t.toLowerCase().indexOf(query);
  if (idx >= 0) {
    return esc(t.slice(0, idx)) + '<mark class="hl">' + esc(t.slice(idx, idx + query.length)) + '</mark>' + esc(t.slice(idx + query.length));
  }
  const chars = Array.from(t);
  const q2 = query.replace(/\s/g, '');
  const cands = [{ arr: chars.map((c) => pinyinOf(c)) }, { arr: chars.map((c) => pyInitials(c)) }];
  let best = null;
  for (const c of cands) {
    const at = c.arr.join('').indexOf(q2);
    if (at >= 0 && (!best || at < best.at)) best = { arr: c.arr, at };
  }
  if (!best) return esc(t);
  let acc = 0, s = -1, e = -1;
  for (let i = 0; i < chars.length; i++) {
    const segLen = (best.arr[i] || '').length;
    const segStart = acc, segEnd = acc + segLen;
    if (s < 0 && best.at < segEnd) s = i;
    if (s >= 0 && best.at + q2.length > segStart) e = i;
    acc = segEnd;
  }
  if (s < 0 || e < s) return esc(t);
  return esc(chars.slice(0, s).join('')) + '<mark class="hl">' + esc(chars.slice(s, e + 1).join('')) + '</mark>' + esc(chars.slice(e + 1).join(''));
}

/* ---------- 店铺品类自动归类（按名称关键词） ---------- */
function guessShopCat(name) {
  const n = String(name || '');
  if (!n) return '其他';
  // 顺序有讲究：先判特征最强的品类，避免「面包」被「面」抢走
  if (/超市|盒马|山姆|小象|便利|生鲜|菜市|果蔬/.test(n)) return '超市';
  if (/面包|蛋糕|甜点|烘焙|西点|贝甜|度C/.test(n)) return '甜品面包';
  if (/咖啡|瑞幸|库迪|星巴克|拿铁/.test(n)) return '奶茶咖啡';
  if (/奶茶|果茶|奶绿|饮品|水吧|冰淇淋|茶/.test(n)) return '奶茶咖啡';
  if (/汉堡|炸鸡|德克士|麦当劳|肯德基|华莱士|派乐/.test(n)) return '汉堡炸鸡';
  if (/麻辣烫|麻辣拌|冒菜|钵钵|串串|香锅|火锅|烤鱼|烫菜/.test(n)) return '麻辣烫';
  if (/烧烤|烤串|烤肉|串烧|铁板/.test(n)) return '烧烤';
  if (/拉面|刀削|馄饨|饺子|包子|面馆|拌面|汤面|炒面|凉面|面食|面条|粉|米线|螺蛳|酸辣/.test(n)) return '粉面';
  if (/轻食|沙拉|减脂|低脂|健康餐|能量碗/.test(n)) return '轻食沙拉';
  if (/饭|套餐|盖码|煲仔|快餐|便当|黄焖|排骨|烧腊|食堂/.test(n)) return '米饭套餐';
  return '其他';
}

/* ---------- 热度数值（排序用）：「月售 8.6w+」→ 数字，结合评分 ---------- */
function hotScore(id) {
  const h = (typeof SHOP_HOTNESS !== 'undefined' && SHOP_HOTNESS[id]) || null;
  if (!h) return 0;
  const m = String(h.sales || '').match(/([\d.]+)\s*w/i);
  const sales = m ? parseFloat(m[1]) * 10000 : 0;
  return sales * 10 + (Number(h.rating) || 0) * 100;
}
