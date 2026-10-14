function ex(item) {
  return {
    avoid: [],
    equipment: ['bodyweight'],
    kind: 'compound',
    sessions: [],
    order: 50,
    cue: '',
    muscles: '',
    ...item
  }
}

const EXERCISES = [
  ex({ id: 'bb_squat', name: '杠铃深蹲', equipment: ['barbell'], sessions: ['legs', 'lower', 'full'], order: 10, muscles: '大腿、臀部', avoid: ['knee'], cue: '脚掌踩实，膝盖与脚尖同向' }),
  ex({ id: 'goblet_squat', name: '高脚杯深蹲', equipment: ['dumbbell'], sessions: ['legs', 'lower', 'full'], order: 12, muscles: '大腿、臀部', avoid: ['knee'], cue: '哑铃贴近胸口，下蹲时脚跟不离地' }),
  ex({ id: 'bw_squat', name: '自重深蹲', equipment: ['bodyweight'], sessions: ['legs', 'lower', 'full'], order: 14, muscles: '大腿、臀部', avoid: ['knee'], cue: '蹲到大腿接近与地面平行' }),
  ex({ id: 'band_squat', name: '弹力带深蹲', equipment: ['band'], sessions: ['legs', 'lower', 'full'], order: 16, muscles: '大腿、臀部', avoid: ['knee'], cue: '带子固定在肩上，站起时夹紧臀部' }),
  ex({ id: 'leg_press', name: '腿举', equipment: ['machine'], sessions: ['legs', 'lower'], order: 18, muscles: '大腿、臀部', avoid: ['knee'], cue: '不要在底端锁死膝盖' }),
  ex({ id: 'lunge', name: '哑铃箭步蹲', equipment: ['dumbbell'], sessions: ['legs', 'lower'], order: 30, muscles: '大腿、臀部', avoid: ['knee'], cue: '前膝朝脚尖，后膝轻轻靠近地面' }),
  ex({ id: 'rdl_bb', name: '杠铃罗马尼亚硬拉', equipment: ['barbell'], sessions: ['legs', 'lower', 'full'], order: 20, muscles: '臀部、大腿后侧', avoid: ['lower_back'], cue: '髋往后坐，杠铃贴着腿下滑' }),
  ex({ id: 'rdl_db', name: '哑铃罗马尼亚硬拉', equipment: ['dumbbell'], sessions: ['legs', 'lower', 'full'], order: 22, muscles: '臀部、大腿后侧', avoid: ['lower_back'], cue: '背打直，哑铃沿腿下滑' }),
  ex({ id: 'deadlift', name: '杠铃硬拉', equipment: ['barbell'], sessions: ['pull', 'lower', 'full'], order: 48, muscles: '背部、臀部', avoid: ['lower_back'], cue: '先推开地面，再站直髋' }),
  ex({ id: 'hip_thrust', name: '臀桥', equipment: ['bodyweight'], sessions: ['legs', 'lower', 'full'], order: 24, muscles: '臀部', cue: '顶起时夹紧臀部，肋骨不要外翻' }),
  ex({ id: 'leg_curl', name: '腿弯举', equipment: ['machine'], kind: 'isolation', sessions: ['legs', 'lower'], order: 110, muscles: '大腿后侧', cue: '动作放慢，顶端停一下' }),
  ex({ id: 'calf', name: '站姿提踵', equipment: ['bodyweight'], kind: 'isolation', sessions: ['legs', 'lower'], order: 120, muscles: '小腿', cue: '顶起后停一秒再落下' }),
  ex({ id: 'bb_bench', name: '杠铃卧推', equipment: ['barbell'], sessions: ['push', 'upper', 'full'], order: 20, muscles: '胸、肩、三头', cue: '肩胛收稳，杠铃落到胸口中部' }),
  ex({ id: 'db_bench', name: '哑铃卧推', equipment: ['dumbbell'], sessions: ['push', 'upper', 'full'], order: 22, muscles: '胸、肩、三头', cue: '哑铃垂直下落，手肘约 45 度' }),
  ex({ id: 'pushup', name: '俯卧撑', equipment: ['bodyweight'], sessions: ['push', 'upper', 'full'], order: 26, muscles: '胸、肩、三头', avoid: ['wrist'], cue: '身体成一条直线，胸口靠近地面' }),
  ex({ id: 'machine_press', name: '器械推胸', equipment: ['machine'], sessions: ['push', 'upper'], order: 28, muscles: '胸', cue: '推起时不要耸肩' }),
  ex({ id: 'ohp_bb', name: '杠铃肩推', equipment: ['barbell'], sessions: ['push', 'upper'], order: 34, muscles: '肩、三头', avoid: ['shoulder'], cue: '肋骨收住，杠铃推到头顶偏后' }),
  ex({ id: 'ohp_db', name: '哑铃肩推', equipment: ['dumbbell'], sessions: ['push', 'upper'], order: 36, muscles: '肩、三头', avoid: ['shoulder'], cue: '坐直，哑铃从耳侧向上推' }),
  ex({ id: 'pike_pushup', name: '折刀俯卧撑', equipment: ['bodyweight'], sessions: ['push', 'upper'], order: 38, muscles: '肩、三头', avoid: ['shoulder', 'wrist'], cue: '臀部抬高，头从两手之间向下' }),
  ex({ id: 'dip', name: '双杠臂屈伸', equipment: ['bodyweight'], sessions: ['push', 'upper'], order: 40, muscles: '胸、三头', avoid: ['shoulder'], cue: '身体略前倾，手肘不要外翻过大' }),
  ex({ id: 'lateral', name: '哑铃侧平举', equipment: ['dumbbell'], kind: 'isolation', sessions: ['push', 'upper'], order: 130, muscles: '肩中束', avoid: ['shoulder'], cue: '手肘微屈，举到肩高即可' }),
  ex({ id: 'cable_fly', name: '绳索夹胸', equipment: ['cable'], kind: 'isolation', sessions: ['push', 'upper'], order: 140, muscles: '胸', cue: '双手在身前汇合，停一秒' }),
  ex({ id: 'bb_row', name: '杠铃划船', equipment: ['barbell'], sessions: ['pull', 'upper', 'full'], order: 30, muscles: '背、二头', avoid: ['lower_back'], cue: '躯干稳定，把杠铃拉向肚脐' }),
  ex({ id: 'db_row', name: '哑铃划船', equipment: ['dumbbell'], sessions: ['pull', 'upper', 'full'], order: 32, muscles: '背、二头', cue: '一手撑稳，手肘贴近身体拉起' }),
  ex({ id: 'pullup', name: '引体向上', equipment: ['pullup'], sessions: ['pull', 'upper', 'full'], order: 33, muscles: '背、二头', avoid: ['shoulder'], cue: '从肩胛下沉开始拉，下巴过杆' }),
  ex({ id: 'lat_pulldown', name: '高位下拉', equipment: ['cable'], sessions: ['pull', 'upper'], order: 34, muscles: '背', cue: '把横杆拉到锁骨，不要后仰借力' }),
  ex({ id: 'seated_row', name: '坐姿划船', equipment: ['cable'], sessions: ['pull', 'upper'], order: 42, muscles: '背', cue: '先打开胸，再把手柄拉向腹部' }),
  ex({ id: 'band_row', name: '弹力带划船', equipment: ['band'], sessions: ['pull', 'upper', 'full'], order: 44, muscles: '背', cue: '带子踩稳，手肘向后拉' }),
  ex({ id: 'inverted_row', name: '反向划船', equipment: ['bodyweight'], sessions: ['pull', 'upper', 'full'], order: 46, muscles: '背', avoid: ['wrist'], cue: '身体绷直，胸口拉向把手' }),
  ex({ id: 'db_curl', name: '哑铃弯举', equipment: ['dumbbell'], kind: 'isolation', sessions: ['pull', 'upper'], order: 150, muscles: '二头', avoid: ['wrist'], cue: '大臂贴住身体，不要甩动' }),
  ex({ id: 'face_pull', name: '面拉', equipment: ['cable', 'band'], kind: 'isolation', sessions: ['pull', 'upper'], order: 160, muscles: '肩后束、上背', cue: '把手拉向面部，结束时外旋' }),
  ex({ id: 'plank', name: '平板支撑', equipment: ['bodyweight'], kind: 'isolation', sessions: ['full', 'upper'], order: 170, muscles: '核心', avoid: ['wrist'], cue: '臀部不要塌，保持均匀呼吸' }),
  ex({ id: 'walk', name: '快走', equipment: ['bodyweight'], kind: 'cardio', sessions: ['recovery'], order: 200, muscles: '有氧', cue: '保持能说话的配速，连续走 30 分钟' })
]

const EQUIPMENT_LABELS = {
  barbell: '杠铃',
  dumbbell: '哑铃',
  machine: '器械',
  cable: '绳索',
  bodyweight: '自重',
  band: '弹力带',
  pullup: '引体向上杆'
}

const INJURY_LABELS = {
  knee: '膝盖',
  lower_back: '腰',
  shoulder: '肩',
  wrist: '手腕'
}

module.exports = { EXERCISES, EQUIPMENT_LABELS, INJURY_LABELS }
