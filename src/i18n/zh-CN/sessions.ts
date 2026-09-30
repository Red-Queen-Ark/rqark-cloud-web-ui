export const sessions = {
  title: 'Sessions',
  subtitle: '存储在你账号下的对话 Session。',
  hint: '列出该账号里的全部 Session，最近更新的排在最前。',
  loading: '加载中',
  empty: '没有找到 Session。',
  emptyDesc: 'App 开始对话之后，Session 就会出现在这里。',
  sessionTitle: '标题',
  planItems: '计划条目',
  created: '创建日期',
  updated: '更新日期',
  actions: '操作',
  view: '查看',
  back: '返回 Session 列表',
  loadError: '无法加载 Session',

  detailHint: '单个 Session，只读，连同它保存的消息。',
  detailLoading: '正在加载 Session',
  detailNotFound: '没有这个 Session。',
  detailNotFoundDesc: '它不存在，或者属于另一个账号。',
  sessionId: 'Session ID',
  untitled: '未命名 Session',

  metadata: '详细信息',
  messages: '消息',
  noMessages: '这个 Session 还没有消息。',
  messageOrder: '从最旧的排起，按发出的顺序。这里只有引擎会写入，所以这个视图是只读的。',
  rawPayload: '内容',

  planTitle: '计划',
  planEmpty: '这个 Session 没有计划。',

  planStatus: {
    pending: '待处理',
    inProgress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
  },

  role: {
    system: '系统',
    user: '用户',
    assistant: '助手',
    tool: '工具',
  },
};
