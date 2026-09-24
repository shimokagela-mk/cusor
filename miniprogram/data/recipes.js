const TEMPLATES = [
  { id: 'bf_oats', meal: 'breakfast', name: '燕麦牛奶鸡蛋', badge: '健身餐', items: [
    { foodId: 'oats', baseGrams: 50 }, { foodId: 'milk', baseGrams: 250 }, { foodId: 'egg', baseGrams: 100 }, { foodId: 'banana', baseGrams: 80 }
  ]},
  { id: 'bf_bread', meal: 'breakfast', name: '全麦面包花生酱', badge: '家常', items: [
    { foodId: 'bread', baseGrams: 70 }, { foodId: 'peanut', baseGrams: 16 }, { foodId: 'egg', baseGrams: 100 }, { foodId: 'apple', baseGrams: 120 }
  ]},
  { id: 'bf_congee', meal: 'breakfast', name: '小米粥鸡蛋', badge: '家常', items: [
    { foodId: 'congee', baseGrams: 300 }, { foodId: 'egg', baseGrams: 100 }, { foodId: 'bun', baseGrams: 80 }
  ]},
  { id: 'bf_soy', meal: 'breakfast', name: '燕麦豆浆鸡蛋', badge: '家常', items: [
    { foodId: 'oats', baseGrams: 50 }, { foodId: 'soy_milk', baseGrams: 300 }, { foodId: 'egg', baseGrams: 100 }, { foodId: 'banana', baseGrams: 80 }
  ]},
  { id: 'bf_yogurt', meal: 'breakfast', name: '酸奶燕麦水果', badge: '健身餐', items: [
    { foodId: 'yogurt', baseGrams: 180 }, { foodId: 'oats', baseGrams: 40 }, { foodId: 'apple', baseGrams: 120 }, { foodId: 'nuts', baseGrams: 10 }
  ]},
  { id: 'lc_chicken', meal: 'lunch', name: '鸡胸米饭西兰花', badge: '健身餐', items: [
    { foodId: 'rice', baseGrams: 200 }, { foodId: 'chicken', baseGrams: 150 }, { foodId: 'broccoli', baseGrams: 150 }
  ]},
  { id: 'lc_beef', meal: 'lunch', name: '牛肉盖饭配蛋', badge: '外卖', items: [
    { foodId: 'beef_rice', baseGrams: 400 }, { foodId: 'egg', baseGrams: 50 }, { foodId: 'cucumber', baseGrams: 100 }
  ]},
  { id: 'lc_tomato', meal: 'lunch', name: '番茄炒蛋盖饭', badge: '家常', items: [
    { foodId: 'rice', baseGrams: 200 }, { foodId: 'tomato_egg', baseGrams: 250 }, { foodId: 'veg_stir', baseGrams: 120 }
  ]},
  { id: 'lc_kungpao', meal: 'lunch', name: '宫保鸡丁盖饭', badge: '外卖', items: [
    { foodId: 'rice', baseGrams: 180 }, { foodId: 'kungpao', baseGrams: 220 }, { foodId: 'cucumber', baseGrams: 100 }
  ]},
  { id: 'lc_tofu', meal: 'lunch', name: '豆腐米饭时蔬', badge: '家常', items: [
    { foodId: 'rice', baseGrams: 200 }, { foodId: 'tofu', baseGrams: 200 }, { foodId: 'spinach', baseGrams: 120 }, { foodId: 'egg', baseGrams: 50 }
  ]},
  { id: 'lc_salad', meal: 'lunch', name: '鸡胸沙拉配玉米', badge: '健身餐', items: [
    { foodId: 'chicken_salad', baseGrams: 320 }, { foodId: 'corn', baseGrams: 120 }, { foodId: 'bread', baseGrams: 35 }
  ]},
  { id: 'lc_dumpling', meal: 'lunch', name: '猪肉水饺', badge: '外卖', items: [
    { foodId: 'dumpling', baseGrams: 220 }, { foodId: 'cucumber', baseGrams: 120 }, { foodId: 'egg', baseGrams: 50 }
  ]},
  { id: 'dn_salmon', meal: 'dinner', name: '三文鱼红薯蔬菜', badge: '健身餐', items: [
    { foodId: 'salmon', baseGrams: 130 }, { foodId: 'sweet_potato', baseGrams: 180 }, { foodId: 'broccoli', baseGrams: 150 }
  ]},
  { id: 'dn_shrimp', meal: 'dinner', name: '虾仁荞麦面', badge: '家常', items: [
    { foodId: 'soba', baseGrams: 250 }, { foodId: 'shrimp', baseGrams: 140 }, { foodId: 'spinach', baseGrams: 100 }
  ]},
  { id: 'dn_pork', meal: 'dinner', name: '猪里脊土豆', badge: '家常', items: [
    { foodId: 'pork', baseGrams: 140 }, { foodId: 'potato', baseGrams: 180 }, { foodId: 'veg_stir', baseGrams: 150 }
  ]},
  { id: 'dn_mapo', meal: 'dinner', name: '麻婆豆腐米饭', badge: '家常', items: [
    { foodId: 'rice', baseGrams: 160 }, { foodId: 'mapo', baseGrams: 280 }, { foodId: 'spinach', baseGrams: 100 }
  ]},
  { id: 'dn_box', meal: 'dinner', name: '健身餐鸡胸配饭', badge: '健身餐', items: [
    { foodId: 'fitness_box', baseGrams: 380 }, { foodId: 'cucumber', baseGrams: 100 }
  ]},
  { id: 'dn_tofu', meal: 'dinner', name: '豆腐红薯清炒', badge: '家常', items: [
    { foodId: 'tofu', baseGrams: 220 }, { foodId: 'sweet_potato', baseGrams: 180 }, { foodId: 'veg_stir', baseGrams: 150 }, { foodId: 'egg', baseGrams: 50 }
  ]},
  { id: 'dn_fried', meal: 'dinner', name: '蛋炒饭配青菜', badge: '外卖', items: [
    { foodId: 'fried_rice', baseGrams: 320 }, { foodId: 'veg_stir', baseGrams: 150 }, { foodId: 'chicken', baseGrams: 80 }
  ]},
  { id: 'sn_yogurt', meal: 'snack', name: '酸奶苹果', badge: '健身餐', items: [
    { foodId: 'yogurt', baseGrams: 150 }, { foodId: 'apple', baseGrams: 150 }
  ]},
  { id: 'sn_nuts', meal: 'snack', name: '坚果香蕉', badge: '家常', items: [
    { foodId: 'nuts', baseGrams: 20 }, { foodId: 'banana', baseGrams: 100 }
  ]},
  { id: 'sn_whey', meal: 'snack', name: '蛋白粉牛奶', badge: '健身餐', items: [
    { foodId: 'whey', baseGrams: 30 }, { foodId: 'milk', baseGrams: 250 }
  ]},
  { id: 'sn_soy', meal: 'snack', name: '豆浆玉米', badge: '家常', items: [
    { foodId: 'soy_milk', baseGrams: 300 }, { foodId: 'corn', baseGrams: 120 }
  ]},
  { id: 'sn_tuna', meal: 'snack', name: '金枪鱼黄瓜', badge: '健身餐', items: [
    { foodId: 'tuna', baseGrams: 80 }, { foodId: 'cucumber', baseGrams: 120 }, { foodId: 'bread', baseGrams: 35 }
  ]},
  { id: 'sn_tofu', meal: 'snack', name: '豆腐苹果', badge: '家常', items: [
    { foodId: 'tofu', baseGrams: 120 }, { foodId: 'apple', baseGrams: 150 }
  ]}
]

module.exports = { TEMPLATES }
