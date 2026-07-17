export default {
  meta: { name: '简体中文', htmlLang: 'zh-CN' },
  common: {
    productLibrary: '产品与知识',
    workspace: '工作台', growth: '业务增长', system: '系统', searchWorkspace: '搜索工作台', searchPlaceholder: '搜索页面、产品或商机…',
    pages: '页面', navigate: '上下选择', open: '打开', view: '查看', browseAll: '查看全部', filter: '筛选', retry: '重试', moreActions: '更多操作',
    all: '全部', none: '无', notYet: '尚未登录', dueToday: '今天到期', dueTomorrow: '明天到期', friday: '星期五', yesterday: '昨天',
    language: '语言', signedInAs: '当前登录', noMatches: '没有匹配的页面。', actionNoted: '操作已记录。',
    edit: '编辑', close: '关闭', cancel: '取消', save: '保存', create:'创建'
  },
  roles: { Admin: '系统管理员', Owner: '企业管理员', 'Sales Admin': '企业管理员', Sales: '销售人员', Designer: '方案专员', VA: '运营专员' },
  nav: {
    libraryProducts: '产品', libraryCategories: '产品分类', libraryTags: '产品标签', libraryAttributes: '规格属性', libraryVariants: '规格款式',
    inquiries: '询盘', newInquiry: '+ 新建询盘', myTasks: '我的任务', salesCustomers: '客户', salesQuotes: '报价', salesQuotesPi: '报价与PI', salesOrders: '销售订单', salesTasks: '任务',
    dashboard: '工作台', products: '产品', aiKnowledgeCenter: 'AI知识中心', knowledgeDashboard: '产品数据完整度', opportunityIntelligence: '商机智能', imports: '产品导入中心', images: 'AI图片中心', proposals: '方案生成器',
    cases: '项目案例库', crm: '客户管理', salesAi: 'AI销售话术中心', contentAi: 'AI内容中心', coreFoundation: '基础配置', debugCenter: '系统调试中心', settings: '系统设置', help: '帮助'
  },
  login: {
    storyEyebrow: '专为餐饮项目打造', storyTitle: '把家具专业能力转化为更多餐饮项目订单。',
    storyBody: '让销售、设计、采购与运营团队在同一个工作台协作，用共享知识和实用 AI 提升项目效率。',
    proofTitle: '一个团队，一套可信数据。', proofBody: '从首次询盘到生产交接，全程协同。', kicker: '团队工作台', welcome: '欢迎回来',
    subtitle: '登录后继续使用工作台。', email: '邮箱地址', password: '密码', signIn: '登录工作台', signingIn: '正在登录…',
    demoRoles: '演示角色', demoPassword: '所有演示账号密码均为', privateWorkspace: '公司内部工作台 · 仅限授权团队成员使用',
    showPassword: '显示密码', hidePassword: '隐藏密码', invalidCredentials: '邮箱或密码不正确。'
  },
  shell: {
    supportTitle: '需要帮助？', supportBody: '查看团队使用指南', notifications: '通知', allCaughtUp: '暂无新通知。', accountMenu: '账号菜单',
    myProfile: '我的资料', signOut: '退出登录', profileNext: '个人资料编辑将在下一版本开放。',
    helpTitle: '帮助', helpBody: '通过团队使用指南了解工作台导航和操作规范。', helpAccount: '账号与权限', helpAccountBody: '当职责或访问权限需要调整时，请联系系统管理员或企业管理员。', helpWorkflow: '流程指南', helpWorkflowBody: '请遵循各可用流程中显示的人工审核与审计步骤。'
  },
  inquiries: { title: '询盘', subtitle: '查看已有询盘，或录入新的客户需求。', newAction: '新建询盘' },
  productFoundation: {
    productsTitle: '产品智能中心', productsSubtitle: 'AI销售系统的产品数据工作台。', newProduct: '新建产品', products: '产品', productListHelp: '供销售、报价、PI和AI数据完整度使用的产品库记录。',
    categories: '产品分类', categoriesHelp: '管理产品分类及其适用的规格属性。', newCategory: '新建产品分类', categoryAttributes: '分类规格属性模板',
    tags: '产品标签', tagsHelp: '产品标签用于搜索、营销和使用场景，不用于保存尺寸、材质等正式规格。', newTag: '新建产品标签',
    attributes: '规格属性', attributesHelp: '定义可复用并按产品分类配置的正式产品规格。', newAttribute: '新建规格属性', englishName: '英文名称', chineseName: '中文名称', attributeCode: '属性编码', codeHelp: '根据英文名称自动生成；属性使用后编码保持稳定。', allowedValues: '可选值', minimum: '最小值', maximum: '最大值',
    variants: '规格款式', variantsHelp: '规格款式是同一产品型号下仅少量规格不同的具体款式。', newVariant: '新建规格款式', parentProduct: '所属产品', variantOptions: '规格选项', variantName: '规格名称', variantImage: '规格图片', salesPriceOverride: '销售价覆盖', overrideDefaults: '覆盖产品默认值', overrideHelp: '留空时继承产品默认值。', commercialSupplier: '商业与供应信息',
    variantAxes: '规格款式轴', axisEligible: '可作为规格款式轴', axisWarning: '该产品存在较多核心差异，建议确认是否应拆分为不同产品。', fixedAttributes: '产品固定属性', saveAttributes: '保存规格属性',
    required: '必填', filterable: '可筛选', showProduct: '产品页', showQuote: '报价', showPi: 'PI', internalOnly: '仅内部', defaultUnit: '默认单位', sortOrder: '排序', active: '启用', disabled: '停用', dataType: '数据类型', unit: '单位', options: '选项', status: '状态', actions: '操作', edit: '编辑', remove: '删除', save: '保存', create: '创建', allCategories: '全部产品分类', allVariants: '全部规格款式', noAttributes: '尚未配置规格属性。', noVariants: '尚未配置规格款式。', inherited: '继承产品', skuHelp: 'SKU指库存单位编码。', cbmHelp: 'CBM指立方米。', moqHelp: 'MOQ指最小起订量。',
    attributesTitle: '规格属性', attributesSubtitle: '按产品分类配置的正式产品及规格款式属性。', newAttribute: '新建规格属性', createAttribute: '创建属性', nameEn: '英文名称', nameZh: '中文名称', generatedFromEnglish: '根据英文名称自动生成', applicableCategories: '适用产品分类', categorySpecificHelp: '请至少选择一个产品分类；属性适用范围必须明确配置。', productLibrary: '产品库', website: '网站', quote: '报价', pi: 'PI', usedBy: '已使用', noAttributes: '尚未配置规格属性。', categoryChangeWarning: '更改产品分类可能使部分原有规格属性不再适用。系统会保留原有值；是否继续并检查新分类规格？', typeText: '文本', typeNumber: '数字', typeSelect: '单选', typeMultiselect: '多选', typeBoolean: '是/否', typeColor: '颜色', typeDimension: '尺寸', typeDate: '日期', defaultSupplier: '默认供应商', supplierSku: '供应商SKU', supplierCost: '供应商成本', supplierLeadTime: '供应商交期（天）', supplierMoq: '供应商MOQ', supplierNotes: '供应商备注', grossWeight: '毛重（kg）', netWeight: '净重（kg）', packingInformation: '包装信息',
    dashboardHeading: 'AI销售系统产品数据工作台', dashboardHelp: '审核产品对销售、报价、PI及未来AI匹配的就绪情况；产品库仍是唯一可信数据源。', allRecords: '全部产品库记录', activeProducts: '有效产品', availableRecords: '可用产品记录', readyQuote: '报价就绪产品', quality80: '数据质量80分以上', readyAi: 'AI就绪产品', ai80: 'AI就绪度80分以上', missingInformation: '信息缺失产品', needsDataWork: '需要补充产品数据', reviewStates: '草稿、待审核或未完成', qualitySummary: '数据质量摘要', qualityHelp: '会阻碍报价和AI就绪的缺失字段。', missingAttributes: '缺少规格属性', missingVariants: '缺少规格款式', missingPricing: '缺少定价信息', statusSummary: '产品状态摘要', statusHelp: '当前产品库工作流状态。', sourceTruth: '产品库 / 产品智能中心', searchProduct: '搜索产品名称或SKU', allDataQuality: '全部数据质量', needsImprovement: '需要完善', allPricing: '全部定价状态', pricingReady: '定价就绪', needsPricing: '需要定价', productImage: '产品图片', skuCode: 'SKU / 产品编码', variantCount: '规格款式数', qualityScore: '数据质量分', aiStatus: 'AI就绪状态'
  },
  productFinal:{
    overview:'基本信息',media:'图片与文档',specifications:'规格属性',variants:'具体规格',pricing:'定价',relationships:'关联推荐',channelReadiness:'渠道准备',backProducts:'返回产品',
    variantOption:'规格变化字段',oneVariantHelp:'每个产品可以没有规格变化，或只设置一个启用的变化字段。',noVariant:'无规格变化',variantValue:'规格值',variantPageHelp:'同一产品型号下，仅一个尺寸、颜色或其他选项不同的具体SKU。',noVariantProduct:'该产品无规格变化，产品编号即为SKU，无需维护默认规格。',existingVariantsDetected:'检测到现有具体规格，但尚未配置规格变化字段。',variantSetupHelp:'请选择当前产品分类允许的一个规格变化字段，然后为每个现有具体规格填写唯一规格值。',configureVariantOption:'配置规格变化字段',inapplicableAttributes:'已保留但不再适用于当前分类的属性值',
    complementary:'配套产品',alternative:'替代产品',frequentlyBought:'常一起购买',upgrade:'升级产品',relationshipsHelp:'关联仅用于推荐，不强制生成方案或PI组合。',channelHelp:'仅准备未来渠道发布数据，不调用外部API。',ready:'就绪',draft:'草稿',salesMode:'销售方式',publishStatus:'发布状态',priceDisplay:'网站价格显示',externalSync:'外部同步',notConnected:'未连接',noRealChannel:'本版本未连接Shopify或WooCommerce API。',
    basicInformation:'基本信息',productStatus:'产品状态',visibility:'可见范围',shortDescription:'简介',fullDescription:'详细说明',quoteDescription:'报价说明',minimumOrder:'最小起订量',channelContent:'渠道内容',storefrontTitleEn:'网站标题（英文）',storefrontTitleZh:'网站标题（中文）',storefrontDescriptionEn:'网站说明（英文）',storefrontDescriptionZh:'网站说明（中文）',requestQuote:'允许询价',customization:'支持定制',
    salesMode_standard_sale:'标准销售',salesMode_quote_only:'仅询价',salesMode_customizable:'可定制',salesMode_project_only:'项目型',publish_draft:'草稿',publish_ready:'就绪',publish_published:'已发布',publish_archived:'已归档',price_exact_price:'明确价格',price_starting_from:'起售价',price_request_quote:'询价',price_hidden:'隐藏',
    categoryCode:'分类编码',descriptionEn:'英文说明',descriptionZh:'中文说明',productCount:'产品数量',attributeCount:'规格属性数量',searchable:'可搜索',storefront:'网站展示',aliases:'字段别名',aliasPlaceholder:'底盘尺寸\n直径\n底盘直径',aliasHelp:'每行一个别名。经人工确认后可用于后续导入匹配。',
    importCenter:'产品导入中心',importHelp:'供应商文件 → 字段匹配 → 产品与规格识别 → 人工审核 → 确认导入。',importUpload:'1 上传文件',importMapping:'2 字段匹配',importDetection:'3 产品与规格识别',importReview:'4 草稿审核',importConfirm:'5 确认导入',imageUnavailable:'图片不可用',
    aiKnowledgeHelp:'管理已批准的公司知识、目标客户画像、销售规则和业务限制。',approvedKnowledge:'已批准知识',aiKnowledgeSeparated:'产品完整度已独立到“产品数据完整度”页面。',contextPreview:'上下文预览',companyKnowledge:'公司知识',targetProfiles:'目标客户画像',knowledge:'知识',type:'类型',revision:'版本',updated:'更新时间',noKnowledge:'暂无知识记录。'
  },
  fields: {
    name: '名称', code: '编码', group: '分组', description: '说明', opportunity: '商机', stage: '阶段', value: '金额', owner: '负责人', nextAction: '下一步行动', product: '产品', sku: '产品编号',
    productName: '产品名称', category: '产品分类', material: '材质', size: '尺寸', priceRange: '价格区间', leadTime: '交期', moq: '起订量', tags: '标签',
    status: '状态', file: '文件', startedBy: '操作人', rows: '总行数', imported: '已导入', issues: '问题', client: '客户', market: '市场',
    validUntil: '有效期至', teamMember: '团队成员', role: '角色', lastActive: '最近登录', module: '功能模块', projectPrompt: '项目描述', dataType: '数据类型', options: '选项（每行一个）', unit: '单位', sortOrder: '排序', display: '显示设置',
    spaceType: '空间类型', aspectRatio: '画面比例', visualDirection: '视觉方向', organization: '公司'
  },
  status: {
    newLead: '新线索', qualified: '已确认需求', proposal: '方案阶段', negotiation: '商务谈判', won: '已成交', lost: '已流失', approved: '已批准',
    review: '待审核', draft: '草稿', archived: '已归档', completed: '已完成', failed: '失败', queued: '排队中', validating: '验证中',
    internalReview: '内部审核', sent: '已发送', published: '已发布', active: '正常', inactive: '已停用', invited: '已邀请', disabled: '已停用', idea: '创意', ready: '已就绪', generating: '生成中'
  },
  dashboard: {
    greeting: '早上好，{{name}}', subtitleAll: '这是今天餐饮家具业务的最新概况。', subtitleSales: '这是今天销售管道的最新情况。',
    openPipeline: '进行中的商机金额', activeOpportunities: '活跃商机', acrossStages: '分布在 4 个阶段', proposalsInProgress: '进行中的方案',
    dueThisWeek: '本周 2 个到期', salesReadyProducts: '可销售产品', addedThisMonth: '本月新增 8 个', priorityPipeline: '重点商机',
    priorityPipelineSub: '最需要跟进的商机项目', viewCrm: '查看商机管理', noOpportunities: '暂无商机。', recentProductActivity: '最近产品动态',
    recentProductActivitySub: '产品知识中心的最新更新', openProducts: '打开产品中心', productApproved: 'Harbor Ash Dining Chair 已批准',
    productApprovedMeta: '产品知识 · 18 分钟前', specUpdated: '卡座规格文件已更新', specUpdatedMeta: 'Linework Modular Booth · 2 小时前',
    importCompleted: '户外产品系列导入完成', importCompletedMeta: '已导入 146 个产品 · 昨天', readiness: '工作台完善度', readinessSub: '核心业务知识覆盖情况',
    foundation: '基础良好', foundationSub: '继续完善产品数据，可提升 AI 输出与方案质量。', specifications: '产品规格', caseCoverage: '项目案例覆盖',
    salesPlaybooks: '销售话术手册', myFocus: '我的重点任务', myFocusSub: '需要你关注的事项', reviewFinish: '审核 Austin 项目饰面板',
    confirmFreight: '确认 Sierra 项目运费估算', approveCopy: '批准案例文案', aiSignal: 'AI 商机提醒', signalTitle: '3 个高意向商机已超过 7 天未联系。',
    signalBody: '一封针对项目的跟进邮件，可能推动价值 11.8 万美元的商机继续前进。', draftFollowups: '生成跟进话术', taskComplete: '任务已标记完成。', taskReopened: '任务已重新打开。'
  },
  products: {
    title: '产品知识中心', subtitle: '团队统一管理产品规格、材质与销售知识的可信资料库。', add: '新增产品',
    library: '产品资料库', librarySub: '{{count}} 个产品 · 可用于销售、方案与 AI', search: '搜索产品名称或产品编号…',
    allCategories: '全部分类', allStatuses: '全部状态', allTags: '全部标签', days: '{{count}} 天', nextBuild: '产品创建表单已列入下一版本。',
    addTitle: '新增产品', editTitle: '编辑产品', skuStyle: 'SKU 风格', skuHelp: 'SKU 格式：品类-风格-流水号，例如 BS-CA-001。',
    autoGenerated: '自动生成', generate: '生成', summary: '产品简介', saved: '产品已保存。', duplicateSku: '该 SKU 已被使用。'
  },
  intelligence: {
    libraryStatus: '产品智能状态', libraryStatusSub: '单一产品数据源的方案就绪情况',
    totalProducts: '产品总数', proposalReadyProducts: '方案就绪产品', productsNeedReview: '待完善产品', missingImages: '缺少图片', missingPrice: '缺少价格', missingAiTags: '缺少 AI 标签',
    allCategories: '全部分类', allBudgetLevels: '全部预算等级', allReadiness: '全部就绪状态', aiTags: 'AI 标签', readinessScore: '产品就绪评分', proposalStatus: '方案就绪状态', readinessSummary: '达到 80 分即为 Proposal Ready。',
    subCategory: '子分类', productSeries: '产品系列', color: '颜色', finish: '表面处理', budgetLevel: '预算等级', recommendedUsage: '推荐用途',
    generateProductInfo: '生成 AI 产品资料', generatedReview: '规则生成内容已填入，请人工审核后保存。', productProfile: '产品智能档案', productProfileSub: '供所有后续模块共享的商业、方案与销售知识。',
    englishDescription: '英文产品描述', shortSalesDescription: '简短销售描述', salesNotes: '销售备注', salesTalkingPoints: '销售话术要点', commonQuestions: '常见问题', commonObjections: '常见异议', proposalUsageNotes: '方案使用说明',
    productImages: '产品图片管理', productImagesSub: '管理已批准的产品视图和预留 AI 图片条目。', uploadImage: '上传产品图片', addAiImage: '添加 AI 生成图片', markMain: '设为主图', linkExistingMedia: '关联已有媒体', imageEntryNote: '本阶段保存图片元数据和 URL；AI 生成入口已预留但未接入。', imageType: '图片类型', imageStatus: '图片状态', imageSaved: '产品图片已保存。',
    relatedCategories: '关联分类', relatedCategoriesSub: '供搜索、方案与未来 API 共用的分类关系。', seoGeo: 'SEO / GEO', seoGeoSub: '供网站、搜索、LLM 和知识问答复用的内容。',
    generateSeo: '生成 SEO', generateGeo: '生成 GEO', generateFaq: '生成 FAQ', generateBuyingGuide: '生成购买指南', seoTitle: 'SEO 标题', seoDescription: 'SEO 描述', metaKeywords: 'Meta 关键词', slug: 'Slug', canonicalUrl: 'Canonical URL', imageAlt: '图片 Alt', imageCaption: '图片说明', productKeywords: '产品关键词',
    llmSummary: 'LLM 摘要', useCases: '使用场景', bestFor: '最适合', notRecommendedFor: '不建议用于', comparison: '对比说明', advantages: '优势', disadvantages: '不足', faq: 'FAQ', buyingGuide: '购买指南', installationGuide: '安装指南', maintenanceGuide: '维护指南', commonProblems: '常见问题', suggestedPrompt: '建议提示词'
  },
  factory: {
    title: 'AI 产品内容工厂', subtitle: '以一张已批准产品图生成可审核的产品、销售、SEO、GEO、Proposal 内容与图片任务。',
    generateEverything: '生成全部内容', sourceImage: '源产品图片', generationMode: '生成模式', fast: '快速模式', standard: '标准模式', premium: '高级模式',
    fastHelp: '仅生成文字 · 预计文字成本 $0.01', standardHelp: '文字加 3 个图片任务 · 每个任务 $0.05', premiumHelp: '文字加 14 个图片任务 · 每个任务 $0.15',
    generatedDraft: '生成内容草稿', imageTasks: '图片生成任务', reviewStatus: '审核状态', noContent: '暂无 AI 内容', draftGenerated: '草稿已生成', pendingReview: '等待审核', approved: '已批准', rejected: '已拒绝', applied: '已应用',
    analyze: '图片分析', descriptionEn: '英文描述', descriptionZh: '中文描述', shortSales: '简短销售描述', seoTitle: 'SEO 标题', seoDescription: 'SEO 描述', metaKeywords: 'Meta 关键词', llmSummary: 'LLM 摘要', faq: 'FAQ', buyingGuide: '购买指南', salesPoints: '销售话术要点', proposalNotes: '方案备注', aiTags: 'AI 标签', styles: '风格', storeTypes: '门店类型', reviewNotes: '审核备注',
    saveDraft: '保存草稿', approveDraft: '批准草稿', rejectDraft: '拒绝草稿', applyProduct: '应用到产品', viewDraft: '查看 AI 草稿', editDraft: '编辑草稿',
    sourceRequired: '请先在媒体 Tab 上传或批准一张产品图片。', generated: '草稿与图片任务已创建，等待人工审核。', saved: 'AI 内容草稿已保存。', reviewed: '审核结果已保存。', appliedMessage: '已批准内容已应用到 Product Intelligence Center。',
    mode: '模式', provider: '模型提供方', taskType: '任务类型', scene: '场景', cost: '预计成本', status: '状态', noTasks: '当前模式没有图片任务。', totalCost: '预计总成本', humanReview: '任何生成内容都不会在批准并点击“应用到产品”之前覆盖正式产品数据。',
    debugTitle: 'AI 产品工厂状态', totalDrafts: '草稿总数', appliedDrafts: '已应用草稿', imageTaskCount: '图片任务', pendingImageTasks: '待处理图片任务', failedImageTasks: '失败图片任务'
  },
  imageGeneration: {
    title: 'AI 图片生成', providerStatus: 'Provider 状态', currentProvider: '当前 Provider', available: 'Provider 可用', apiKey: 'API Key 已配置', model: '模型', maxPerRun: '单次最大任务数', size: '图片尺寸', fallback: 'Fallback',
    runSelected: '运行选中任务', runAll: '运行所有待处理任务', runTask: '运行', retry: '重试失败任务', cancel: '取消任务', preview: '预览生成图片', approve: '批准图片', reject: '拒绝图片', apply: '应用图片到产品', savePrompt: '保存 Prompt', prompt: 'Prompt 编辑器', negativePrompt: 'Negative Prompt', reviewNotes: '审核备注',
    confirmRun: '确认执行图片生成并产生预计成本吗？', selectedRequired: '请至少选择一个待处理图片任务。', runComplete: '图片生成任务执行完成。', taskUpdated: '图片任务已更新。', reviewSaved: '图片审核结果已保存。', imageApplied: '已批准图片已加入产品媒体库。',
    outputPreview: '输出预览', requestId: 'Provider Request ID', dimensions: '尺寸', confidence: 'AI 置信度', started: '开始时间', completed: '完成时间', lastError: '最近错误',
    totalTasks: '任务总数', pendingTasks: '待处理任务', runningTasks: '运行中任务', generatedTasks: '已生成任务', failedTasks: '失败任务', approvedTasks: '已批准任务', appliedTasks: '已应用任务', debugTitle: 'AI 图片生成状态'
  },
  knowledge: {
    title: '知识完整度看板', subtitle: '衡量并完善可供销售、方案、推荐与未来 AI 工作流复用的产品知识。',
    completion: '知识完整度', scoreSummary: '按六项知识信号评估 {{count}} 个产品', withImages: '已有媒体产品', withSizes: '已有尺寸产品', withCases: '已有案例产品', openDashboard: '打开知识看板',
    averageScore: '知识评分', products: '产品数量', activeLibrary: '当前产品库', missingImages: '缺少图片', missingSizes: '缺少尺寸', missingCases: '缺少案例', needsAttention: '需要完善',
    top100: 'Knowledge Top 100', top100Sub: '知识最完整、可直接复用的产品', incomplete: '知识不完整', incompleteSub: '仍需补充知识的产品', score: '知识评分', media: '媒体', cases: '案例', related: '关联产品', open: '打开', openProducts: '打开产品库',
    keywordSearch: '关键词、产品、AI 摘要…', allStoreTypes: '全部门店类型', allStyles: '全部风格', allFeatures: '全部特性', clear: '清除', storeTypes: '门店类型', styles: '风格',
    saveKnowledge: '保存知识', backProducts: '返回产品库', completeness: '知识完整度', scoreOutOf100: '{{score}} / 100', missing: '缺少：{{items}}', complete: '产品知识已完整。', notSet: '未设置',
    knowledgeTab: '知识', mediaTab: '媒体', relatedProducts: '关联产品', relatedCases: '关联案例', suitableStoreTypes: '适用门店类型', suitableStyles: '适用风格', multiSelect: '可选择多个适用项。',
    features: '产品特性', featureSub: '运营与推荐所需的结构化信号。', customerTypes: '目标客户', customerSub: '供 CRM 推荐使用的客户匹配信号。', aiReady: 'AI Ready', aiReadySub: '先保存结构化字段，本模块不连接 AI 服务。',
    aiSummary: 'AI 摘要', aiKeywords: 'AI 关键词', aiSearchKeywords: 'AI 搜索关键词', knowledgePrompt: 'Knowledge Prompt', aiNotes: 'AI 备注', internalNotes: '内部备注', recommendationWeight: 'AI 推荐权重',
    mediaLibrary: '产品媒体', mediaSub: '将已验证媒体元数据关联到产品。', noMedia: '暂无可用媒体记录。', recommendedProducts: '推荐产品', recommendedSub: '作为商业搭配推荐的产品。', aiRelatedProducts: 'AI 关联产品', aiRelatedSub: '为未来 AI 工作流预留的关联关系。',
    usedInProjects: 'Used in Projects', casesSub: '使用该产品的已发布项目案例。', noCases: '暂无已发布案例。', saved: '产品知识已保存。'
  },
  imports: {
    title: '产品导入中心', subtitle: '验证供应商数据，并导入统一、规范的产品知识库。', newImport: '新建导入', dropTitle: '将产品文件拖放到这里',
    dropBody: 'Excel 或 CSV · 最大 10 MB', browseFiles: '选择文件', checklist: '导入检查清单', checklistSub: '按要求准备文件可减少数据问题',
    template: '使用标准字段模板', templateSub: '包含必填字段和允许的格式', oneRow: '每行仅填写一个产品', oneRowSub: '使用产品编号作为唯一标识',
    reviewFlagged: '发布前审核异常数据', reviewFlaggedSub: '任何数据都不会自动进入产品知识中心', history: '导入记录', historySub: '最近的产品数据任务与验证结果',
    toReview: '{{count}} 条待处理', integrationReady: '文件验证流程已准备好接入云存储。'
  },
  images: {
    title: 'AI图片中心', subtitle: '基于结构化产品知识，生成可用于餐饮项目和方案的视觉图。', viewLibrary: '查看图片库', createScene: '创建项目场景',
    createSceneSub: '描述空间、氛围和产品摆放方式。', promptPlaceholder: '迈阿密一家精致的 80 座海滨餐厅，温暖的傍晚光线，使用 Harbor Ash Dining Chair…',
    restaurantDining: '餐厅用餐区', outdoorPatio: '户外露台', hotelRestaurant: '酒店餐厅', cafe: '咖啡馆', presentation: '16:9 演示文稿',
    proposalFormat: '4:3 客户方案', social: '1:1 社交媒体', photoreal: '写实效果', editorial: '杂志风格', concept: '概念设计', generate: '生成概念图',
    placeholderTitle: '项目概念图将在此显示', placeholderBody: '使用具体产品名称并清楚描述餐饮空间，可获得更实用的商业效果。',
    productAware: '基于产品生成', productAwareBody: '引用已批准的产品编号，让视觉图与真实产品保持一致。', proposalReady: '适配客户方案',
    proposalReadyBody: '生成可直接放入客户方案的横版图片。', brandSafe: '统一品牌风格', brandSafeBody: '让视觉方向符合 B2B 业务展示标准。',
    integrationReady: '图片工作流已准备好接入 AI 图片服务。'
  },
  proposals: {
    title: '方案生成器', subtitle: '团队协作制作专业、准确的 B2B 餐饮家具项目方案。', newProposal: '新建方案', templateEyebrow: '从模板开始',
    fullTitle: '完整项目方案', fullBody: '产品选型 · 项目故事 · 商务条款', mostUsed: '最常用', selectionTitle: '产品选型方案',
    selectionBody: '精选产品 · 饰面 · 产品规格', designLed: '设计导向', quickTitle: '快速预算报价', quickBody: '简洁格式 · 快速响应 · 清晰范围',
    salesReady: '销售常用', useTemplate: '使用模板', recent: '最近方案', recentSub: '当前角色可查看 {{count}} 个方案', editorReady: '方案编辑工作台已准备好进入下一阶段开发。',
    pdfLanguage: '客户 PDF 语言', pdfEnglish: 'English（美国客户默认）'
  },
  cases: {
    title: '项目案例库', subtitle: '把已完成项目转化为可在销售沟通和客户方案中重复使用的信任证明。', add: '新增项目案例',
    search: '按项目或市场搜索案例…', allVenueTypes: '全部场所类型', restaurant: '餐厅', hotel: '酒店', outdoor: '户外空间', allMarkets: '全部市场',
    unitedStates: '美国', canada: '加拿大', publishedCase: '已发布案例', viewCase: '查看案例', productFamilies: '{{count}} 个产品系列', coverage: '案例库覆盖情况',
    coverageSub: '按场所类型统计销售案例', restaurants: '餐厅', cafes: '咖啡馆', hotels: '酒店', nextBuild: '项目案例创建功能已列入下一版本。'
  },
  crm: {
    title: '商机客户管理', subtitleAll: '清晰查看团队所有餐饮家具商机和下一步行动。', subtitleSales: '查看你的餐饮家具商机、下一步行动与项目进展。',
    add: '新增商机', active: '{{count}} 个活跃商机', weighted: '加权商机金额', probabilityAdjusted: '按成交概率计算', proposalStage: '方案阶段商机',
    needsFollowup: '需要跟进', wonPeriod: '本期已成交', teamResult: '团队业绩', nextBuild: '商机创建功能已列入下一版本。'
  },
  salesAi: {
    title: 'AI销售话术中心', subtitle: '基于产品、案例和活跃商机，为销售提供实用 AI 工具。', playbooks: '销售话术手册', brief: '商机简报',
    briefBody: '根据 CRM 信息生成会前简报，包括项目风险、重点与建议问题。', createBrief: '生成简报', followup: '跟进话术生成器',
    followupBody: '结合客户项目、商机阶段和下一步行动，生成有针对性的跟进内容。', draftFollowup: '生成跟进话术', recommender: '产品推荐助手',
    recommenderBody: '把餐饮项目需求与已批准产品匹配，并说明商业适配原因。', recommend: '推荐产品', objection: '异议应对教练',
    objectionBody: '针对交期、定制、运输和质量等常见问题准备专业回答。', openCoach: '开始演练', notes: '会议纪要整理',
    notesBody: '把原始记录整理为决策、下一步行动、产品需求与 CRM 更新。', processNotes: '整理纪要', research: '客户研究',
    researchBody: '为餐饮集团、设计师和酒店餐饮运营商制定重点研究计划。', startResearch: '开始研究', recommended: '建议行动',
    recommendedSub: 'AI 根据活跃商机识别的销售时机', followPacific: '跟进 Pacific Venue Co.', followPacificMeta: '8 天未回复 · 新线索 · 5.2 万美元潜在金额',
    prepareFreight: '准备运费异议回复', prepareFreightMeta: 'Sierra Table Group · 商务谈判 · 周一到期', shortlist: '为 Maison & Marché 制作产品清单',
    shortlistMeta: '已确认需求 · 设计会议安排在 7 月 3 日', integrationReady: '此 AI 工具已准备好接入大模型。'
  },
  contentAi: {
    title: 'AI内容中心', subtitle: '利用产品、专业知识与项目案例，规划并创作可信的 B2B 内容。', create: '创建内容', linkedin: 'LinkedIn 帖子',
    linkedinBody: '把项目、材质知识或销售经验转化为简洁专业的帖子。', startPost: '开始创作', caseStory: '案例故事',
    caseStoryBody: '按挑战、解决方案、产品和成果组织项目文案。', buildStory: '生成故事', buyerGuide: '买家指南',
    buyerGuideBody: '把产品知识整理成餐厅经营者和设计师可用的专业指南。', createGuide: '创建指南', calendar: '内容日历',
    calendarPeriod: '2026 年 6 月 29 日至 7 月 5 日', fullCalendar: '查看完整日历', integrationReady: '内容工作流已准备好接入大模型。'
  },
  foundation: {
    title: '基础配置中心', subtitle: '统一管理所有业务模块共用的基础配置、标签、媒体引用和 AI 提示词。',
    configs: '配置中心', configsSub: '{{count}} 个共用配置项', tags: '标签中心', tagsSub: '{{count}} 个全系统共用标签',
    media: '媒体中心', mediaSub: '{{count}} 条媒体引用', prompts: '提示词中心', promptsSub: '{{count}} 个统一管理的提示词模板',
    add: '新增项目', search: '搜索当前列表…', typeFilter: '按类型筛选', allTypes: '全部类型', allStatuses: '全部状态',
    readOnly: '只读权限', sectionLimited: '当前角色访问此区域受限', sectionLimitedBody: '你仍可使用当前角色有权查看的基础配置和标签。',
    noMatches: '没有匹配的记录', adjustFilters: '请尝试其他关键词、类型或状态。', name: '名称', tagName: '标签名称', promptName: '提示词名称',
    code: '编码', type: '类型', description: '描述', sortOrder: '排序', fileName: '文件名称', fileType: '文件类型',
    mediaCategory: '媒体分类', relatedTo: '关联对象', flags: '标记', fileUrl: '文件地址', storageProvider: '存储服务商',
    relatedModule: '关联模块', relatedRecordId: '关联记录 ID', usageNote: '使用说明', verified: '已验证', aiGenerated: 'AI 生成',
    version: '版本', variables: '变量', promptContent: '提示词内容', addTitle: '新增基础项目', editTitle: '编辑基础项目',
    activate: '启用项目', deactivate: '停用项目', saved: '基础项目已保存。', duplicate: '该名称或编码已被使用。'
  },
  debug: {
    title: '系统调试中心', subtitle: '集中检查应用健康状态、数据库就绪情况、运行资源与最近系统事件。',
    refresh: '刷新诊断', refreshed: '诊断信息已刷新。', healthy: '正常', connected: '已连接', verified: '已验证', missing: '缺失', error: '错误',
    http: 'HTTP 服务', database: '数据库', migration: '数据库迁移', uptime: '运行时间', tableCount: '{{count}} 张表',
    runtime: '运行环境', runtimeSub: '当前服务器进程与部署信息', environment: '环境', platform: '平台', process: '进程', memory: '内存', commit: '提交',
    tables: '数据库表', tablesSub: '发现 {{count}} 张数据表', events: '最近系统事件', eventsSub: '最近的启动和数据库活动', latestError: '最新数据库错误', noEvents: '暂无系统事件。'
  },
  settings: {
    title: '系统设置', subtitle: '管理公司信息、团队权限与工作台标准。', invite: '邀请团队成员', teamMembers: '团队成员',
    teamSub: '当前有 {{count}} 人可访问此工作台', rolesPermissions: '角色与权限', organization: '公司信息', defaults: '工作台默认设置',
    accessOverview: '角色权限总览', accessOverviewSub: '服务器会强制执行模块权限，左侧菜单同步显示可访问内容', inviteReady: '团队邀请功能已准备好接入邮件服务。'
  },
  salesOs: {
    connectorUi: { googlePlaces: 'Google Places API（新版）', geoapifyPlaces: 'Geoapify Places', enabled: '已启用', disabled: '已禁用', credentialAvailable: '凭据可用', credentialMissing: '缺少凭据', estimatedRequests: '预计请求次数', providerRequests: 'Provider请求次数', estimatedCredits: '预计Credits', usedCredits: '已用Credits', calculatedUsageCost: '计算货币成本', searchQuery: '搜索查询', address: '地址', businessType: '企业类型', resolvedLocation: '解析地区', coordinates: '坐标', budgetEstimateDisclaimer: '仅为系统预算估算，不是Provider最终账单金额。' },
    groups: { workspace: '工作台', opportunities: '商机与客户', products: '产品与知识', commercial: '方案与成交', system: '系统' },
    tabs: { dashboard: '商机看板', discovery: 'AI发现', strategies: '搜索策略', tasks: '搜索任务', leads: '潜在线索池', customers: '客户', priority: '优先级视图' },
    discovery: { describe:'描述理想客户', example:'示例：查找加利福尼亚州的小型餐厅家具经销商。', target:'目标客户描述', analyze:'分析需求', analyzing:'正在分析……', analyzed:'✓ 分析完成', generate:'生成搜索计划', generating:'正在生成……', generated:'✓ 搜索计划已生成', create:'创建策略草稿', creating:'正在创建……', open:'打开策略草稿', connected:'已连接', noApi:'不可用', cost:'AI 成本控制已启用。只有点击按钮才会分析，页面加载不会调用外部 AI。', empty:'请描述理想客户，然后点击“分析需求”创建结构化客户发现计划。', stale:'已过期', reanalyze:'输入已修改，请重新分析需求。', error:'操作失败', discoveryPlan:'客户发现计划', guidance:'搜索指导', generatedPlan:'生成的搜索计划', ready:'可开始搜索', needs:'需要确认', type:'目标客户类型', types:'客户类型', industry:'行业', country:'国家', state:'州/省', city:'城市', fullLocation:'完整地点', region:'地区/城市', size:'公司规模', confidence:'置信度', keywords:'搜索关键词', sources:'建议搜索来源', exclude:'排除规则', filters:'建议筛选条件', next:'建议下一步', profile:'动态评分配置', objective:'搜索目标', category:'企业搜索分类', providerCategory:'企业搜索分类代码', quantity:'目标数量', fields:'必需字段', semantics:'实际 Connector 搜索语义', priority:'优先级', reason:'原因', revision:'分析修订', planRevision:'计划修订', basedOn:'基于分析修订', completed:'完成时间', customerSystem:'客户类型系统', customerSystemHelp:'为后续扩展准备的动态客户类别和评分权重。', created:'搜索策略草稿 #{id} 已创建', notConfigured:'未配置', locationSearch:'地点', locationHelp:'输入城市或地区，并选择一个地点候选结果。', locationSearching:'正在搜索地点……', locationSelect:'选择此地点', locationSelected:'已选择地点', locationRequired:'继续前必须选择有效地点。', locationService:'地点服务', businessSearchSource:'企业搜索来源' },
    discoveryCustomerType: { help: '请从客户类型系统中选择一个或多个类型。', required: '请至少选择一个目标客户类型。', viewRules: '查看客户类型规则', companyUnit: '家公司', categoryFurniture: '家具与室内' },
    discoveryDynamic: { industry:'酒店餐饮家具', companySize:'中小型公司', companyWebsite:'公司网站', excludeChains:'大型零售家具连锁店', excludeResidential:'住宅家具店', excludeNonHospitality:'非酒店餐饮家具销售商', broadGuidance:'当前搜索描述较宽泛，执行前补充部分筛选条件可提高结果质量。', companySizeFilter:'公司规模', productCategoryFilter:'产品分类', decisionMakerFilter:'决策人要求', distributorNext:'建议优先搜索中小型餐厅家具经销商。', businessMatch:'业务匹配度', contactAvailability:'联系方式完整度' },
    terms: {
      searchStrategy: '搜索策略', searchTask: '搜索任务', searchExecution: '搜索执行', searchResult: '搜索结果', leadDetail: '线索详情', customer: '客户', aiQualification: 'AI资格评估', rulesAssessment: '规则评估', purchasePotential: '采购潜力', productMatching: '产品匹配', sourceEvidence: '来源与证据', connector: '数据连接器', connectorVersion: '连接器版本', externalId: '外部ID', sourceUrl: '来源链接', capturedTime: '采集时间', duplicateStatus: '重复状态', normalizationVersion: '标准化版本', planningEstimate: '规划估算', estimatedCost: '预计成本', approvedLimit: '批准上限', searchCriteria: '搜索条件', customerType: '客户类型', location: '地区', companySize: '公司规模', priority: '优先级', targetVolume: '目标数量', keywords: '关键词', requiredDataFields: '必需数据字段', filters: '筛选条件', searchResults: '搜索结果', totalResults: '结果总数', converted: '已转为客户', storedCandidates: '已保存候选对象', movedCustomers: '已转入客户管理', openLeads: '待处理线索', score: '评分', websiteContact: '网站与联系方式', website: '网站', contact: '联系方式', aiSummary: 'AI摘要', aiRecommendation: 'AI建议', qualificationReason: '评估理由', referenceNote: '参考说明', activityHistory: '活动历史', phase: '阶段', pages: '页数', received: '接收数量', normalized: '标准化数量', inserted: '新增数量', duplicates: '重复数量', lastHeartbeat: '最后心跳时间', stopReason: '停止原因', unknown: '未知', source: '来源', countryCity: '国家/城市', businessType: '业务类型', customerValue: '客户价值', buyingOpportunity: '采购机会', salesPriority: '销售优先级', grade: '等级', recommendedProducts: '推荐产品', nextAction: '下一步行动', assignedSales: '负责销售', duplicateCheck: '重复检查', openDataGaps: '待补数据', lastAiRun: '上次AI运行'
    },
    actions: { saveDraft: '保存草稿', createDraft: '创建草稿', submitReview: '提交审核', approve: '批准', requestChanges: '要求修改', archive: '归档', markOutdated: '标记为过期', aiGenerate: 'AI生成', planningEstimate: '规划估算', markReady: '标记为就绪', estimateExecution: '执行估算', createExecution: '创建执行', start: '开始', pause: '暂停', resume: '继续', stop: '停止', runAi: '运行AI', updateIntelligence: '更新情报', markReviewed: '标记为已审核', convertCustomer: '转为客户', discard: '放弃', open: '打开', edit: '编辑', back: '返回', viewSource: '查看来源', importCustomers: '导入客户' },
    status: { draft: '草稿', needsReview: '待审核', approved: '已批准', superseded: '已替代', archived: '已归档', new: '新线索', reviewed: '已审核', running: '运行中', paused: '已暂停', completed: '已完成', partiallyCompleted: '部分完成', failed: '失败', interrupted: '已中断', blocked: '被阻止', aiQualified: 'AI评估完成', aiPending: 'AI评估待处理', aiRunning: 'AI评估进行中', aiFailed: 'AI评估失败', aiBlocked: 'AI评估被阻止', complete: '完成', discarded: '已放弃', awaitingApproval: '等待批准', rulesReady: '规则引擎就绪', productConnected: '产品智能已连接' },
    history: { leadCreated: '线索已创建', aiStarted: 'AI评估已开始', aiCompleted: 'AI评估已完成', aiFailed: 'AI评估失败', reviewedBy: '{{name}} 已标记为已审核', converted: '已转为客户', legacy: '历史旧记录' },
    messages: { opportunitySubtitle: '将来源数据转化为整洁、已评分、已匹配产品且经人工确认的销售商机。', leadPoolSubtitle: '审核合格线索后再人工转为客户。', noResults: '暂无搜索结果。', noLeads: '暂无可处理线索。', noCustomers: '暂无客户。', aiPendingSummary: 'AI评估摘要待生成。', noDuplicate: '未检测到重复', noError: '无错误', notProvided: '未提供', notRun: '尚未运行', priorityQueue: '今日优先队列', priorityQueueSubtitle: '需要人工处理的高价值A+/A商机', pipelineStatus: 'AI流程状态', pipelineStatusSubtitle: '规则服务已启用；外部AI仍为可选项。', live: '实时', opportunityMetrics: '商机智能指标', opportunityMetricsSubtitle: '今日客户智能与销售交接准备情况', openEngine: '打开商机引擎', confirmFreight: '确认运费估算', reviewSamples: '审核饰面样品', scheduleCall: '安排设计沟通', sendEmail: '发送需求确认邮件', productionHandoff: '准备生产交接' },
    metrics: { totalCustomers: '客户总数', importedToday: '今日导入', aiProcessed: 'AI已处理', gradeAPlus: 'A+级商机', gradeA: 'A级商机', readyForSales: '销售就绪', missingDecisionMaker: '缺少决策人', missingEmail: '缺少邮箱', missingWhatsApp: '缺少WhatsApp', acceptedLeads: '销售已接受线索' },
    searchUi: { backTasks: '返回搜索任务', controlledExecution: '受控Rules/Mock执行，不调用外部平台。', providerComplete: '数据提供商执行完成', checkpointError: '检查点与最后错误', resultsSubtitle: '先保存人工发现的线索，再进入潜在线索池', addResult: '新增搜索结果', entryHelp: '约30秒完成录入。保存后可运行AI资格评估；当前未连接外部搜索API。', companyName: '公司名称', country: '国家', city: '城市', sourceType: '来源类型', contactOptional: '联系方式（可选）', customerEvidence: '客户证据', evidencePlaceholder: 'Google Maps、Instagram、网站或LinkedIn链接', notePlaceholder: '用于后续交接的简短说明', attachmentHelp: '截图/附件功能预留；当前请保存来源链接或说明。', saveResult: '保存搜索结果', company: '公司', potential: '采购潜力', status: '状态', actions: '操作', restaurantDealers: '餐厅家具经销商', unitedStates: '美国', medium: '中', high: '高', low: '低', decisionMaker: '决策人', manual: '人工录入', other: '其他', noContact: '暂无联系方式', missing: '缺失', reviewLead: '审核线索' },
    leadUi: { backPool: '返回潜在线索池', formalAi: '正式AI资格评估', initialRules: '初步规则/人工数据', customerIntelligence: '客户情报', customerIntelligenceHelp: '该线索尚未转入客户管理。请结合AI评估、来源证据和产品匹配结果，人工决定是否转为客户。', historyHelp: '转入客户管理前的线索流程记录', capturedMock: '由已批准的Rules/Mock连接器采集。', immediateReview: '立即审核，确认决策人并准备首次销售触达。', productDirection: '运行资格评估以生成产品方向。', noReason: '暂无评估理由。', convertDecision: '审核线索并决定是否转为客户。', mockAiSummary: 'Northwest Table Base Co是位于美国西雅图的餐厅家具经销商候选线索，采购潜力为高。', mockProductMatch: '该公司为酒店餐饮家具经销商，建议提供卡座、餐厅桌和餐椅等可重复采购的目录产品。', mockQualification: '该餐厅家具经销商符合当前搜索任务；采购潜力为高；已有可用联系方式或网站；来源证据已保存供后续交接。证据说明：由已批准的Rules/Mock连接器采集。' },
    listUi: { searchTasksSubtitle: '查看已创建的搜索任务并进入详情执行后续操作。', taskName: '任务名称', quantity: '数量', createdAt: '创建时间', noSearchTasks: '暂无搜索任务。请先生成搜索计划并创建搜索任务。', companyName: '公司名称', source: '来源', businessCategory: '业务分类', cityRegion: '城市/地区', websitePhoneStatus: '网站/电话状态', reviewStatus: '审核状态', websiteAvailable: '有网站', websiteMissing: '无网站', phoneAvailable: '有电话', phoneMissing: '无电话' },
    qualificationFlow: { title:'AI Lead分析', subtitle:'规则预筛后自动批量分析；AI不会自动转为Customer。', analyzing:'分析中', recommended:'建议开发', needsConfirmation:'需要确认', notRecommended:'不建议开发', waiting:'等待分析', none:'无', kept:'已保留', keep:'保留', abandoned:'已放弃', abandon:'放弃', viewEvidence:'查看证据', companyName:'公司名称', aiConclusion:'AI结论', score:'分数', oneSentenceReason:'1句理由', missingInfo:'缺失信息', evidence:'证据', noLeads:'暂无Lead', found:'已找到{{count}}家', analyzed:'已分析{{analyzed}}/{{total}}', complete:'分析完成', supplemental:'异常或补充资料', evidenceTech:'查看证据与技术信息', humanAction:'人工处理', noAutoCustomer:'AI结果仅供评估，不会自动转为Customer。只有证据异常或补充资料后才需要重新分析。', refreshReanalyze:'刷新证据并重新分析', refreshed:'证据已更新并重新分析。' },
    taskSummary: { connectorCredits:'Connector与Credits', found:'找到数量', analyzed:'已分析数量', preview:'本次Lead摘要', previewHelp:'仅显示前5条，其余请进入潜在线索池统一审核。', viewLeads:'查看本次Lead' },
    leadReview: { allTasks:'全部搜索任务', allRegions:'全部地区', allConclusions:'全部AI结论', allScores:'全部分数', allStatuses:'全部审核状态', filteredCount:'当前筛选共{{count}}条Lead' },
    customerPage: { subtitle:'仅显示由人工确认并转换的正式Customer。', empty:'当前还没有由合格Lead转换的客户。' },
    leadDetailIa: { decisionCard:'人工决策卡', recommendedAction:'推荐动作', lastAnalyzed:'最后分析时间', aiConclusion:'AI结论', reasonRisk:'推荐理由与风险', providerFacts:'Provider事实', standardizedFields:'系统标准化字段', providerCategory:'Provider分类', providerAddress:'Provider地址', providerPhone:'Provider电话', initialType:'初始客户类型', evaluationTarget:'评估目标', enrichment:'官网与证据补全', enrichmentStatus:'补全状态', officialWebsite:'官方网站', publicEmail:'公开邮箱', contactPage:'联系页面', businessDescription:'业务介绍', businessEvidence:'业务证据', positiveEvidence:'支持结论的关键证据', negativeEvidence:'负面证据', scoringReason:'评分原因', evidenceSource:'证据来源', sourcePages:'来源页面' },
    legacyUi: {
      addProduct: '新增产品', editProduct: '编辑产品', deleteProduct: '删除产品', createProduct: '创建产品', addCategory: '新增分类', newCategory: '新建分类', createCategory: '创建分类', addTag: '新增标签', newTag: '新建标签', createTag: '创建标签', addAttribute: '新增属性', newAttribute: '新建属性', createAttribute: '创建属性', newVariant: '新建变体', createVariant: '创建变体', addVariant: '新增变体', delete: '删除', enable: '启用', disable: '停用', history: '历史记录', newRevision: '新建修订版', cancelEdit: '取消编辑', backProducts: '返回产品', openCustomer: '打开客户', analyzeRequirement: '分析需求', generateSearchPlan: '生成搜索计划', createStrategy: '创建策略草稿', createTask: '创建搜索任务草稿', archiveStrategy: '归档策略', contextPreview: '上下文预览', analyzeCustomers: '分析所选客户', saveRunIntelligence: '保存并运行客户智能', saveFeedback: '保存反馈', acceptLead: '接受线索', generatePackage: '生成家具方案包', generateQuote: '生成报价', generatePi: '生成形式发票', convertOrder: '转为订单', markSent: '手动标记为已发送', previewPi: '预览形式发票', exportPdf: '导出PDF', exportExcel: '导出Excel', addLibraryProduct: '从产品库添加产品', addCustomItem: '添加自定义项目', next: '下一步', previous: '上一步',
      name: '名称', group: '分组', dataType: '数据类型', options: '选项（每行一个）', unit: '单位', sortOrder: '排序', display: '显示设置', dimensions: '尺寸', referencePrice: '参考价格', costPrice: '成本价', allCategories: '全部分类', allVariants: '全部变体', description: '描述', shortDescription: '简短描述', updated: '更新时间', lastUpdated: '最后更新', pricing: '定价', pricingSummary: '定价摘要', pricingStatus: '定价状态', sellingCurrency: '销售币种', supplierCost: '供应商成本', supplierCurrency: '供应商币种', convertedCost: '折算成本', recommendedSelling: '建议销售价', ruleName: '规则名称', calculationMethod: '计算方式', multiplierMargin: '倍数/毛利', rounding: '取整规则', productFoundation: '产品基础信息', configurableAttributes: '可配置属性', relatedProducts: '关联产品', frequentlyBought: '常一起购买', productImages: '产品图片', uploadImage: '上传图片', markMain: '设为主图', basicInfo: '基本信息', industry: '行业', purchaseTiming: '采购时间', confidence: '置信度', originalSource: '原始来源', evidence: '证据', customerSource: '客户来源', opportunityStatus: '商机状态', recommendedAction: '建议行动', feedback: '反馈', amount: '金额', quantity: '数量', unitPrice: '单价', lineTotal: '行总额', total: '总计', currency: '币种', issueDate: '签发日期', validUntil: '有效期至', paymentTerms: '付款条款', freight: '运费', destination: '目的地', remarks: '备注', attachments: '附件',
      productCenter: '产品智能中心', productDetails: '产品详情', productStatus: '产品状态', productCompleteness: '产品完整度', pricingReady: '定价就绪', needsImprovement: '需要完善', productReviewHelp: '审核产品对销售、报价、形式发票及未来AI匹配的就绪情况；产品库仍是唯一可信数据源。', variantsHelp: '统一管理变体、可配置属性、关联产品及常一起购买的产品。', noProducts: '暂无产品。', noVariants: '暂无变体。', noAttributes: '暂无属性。', noImages: '暂无已上传图片。', noContacts: '暂无联系人。', noFeedback: '暂无反馈。', noEvidence: '暂无证据更新记录。', noImports: '暂无导入批次。', noDrafts: '未检测到草稿。', noMatches: '没有匹配的产品。', noKnowledge: '暂无知识记录。', noTasks: '暂无搜索任务。请先生成搜索计划，再创建搜索任务。', requestQuote: '询价', comingSoon: '即将推出', discontinued: '已停产', hidden: '已隐藏', urgent: '紧急', normal: '普通', allStatuses: '全部状态', allSources: '全部来源', allGrades: '全部等级', allCustomerTypes: '全部客户类型',
      importReview: '产品导入审核', uploadSettings: '上传与导入设置', analyzeSpreadsheet: '分析表格', smartResult: '智能分析结果', detectedProducts: '检测到的产品', detectedVariants: '检测到的变体', mappedColumns: '已映射列', embeddedImages: '内嵌图片', draftReview: '草稿审核', editMappings: '导入产品库前请审核并编辑字段映射。', importResult: '导入结果', createdProducts: '已创建产品', createdVariants: '已创建变体', skippedRows: '跳过行数', errors: '错误', importBatches: '导入批次', approveImport: '批准并导入', approveSelected: '批准所选', mergeSelected: '合并所选', splitProducts: '拆分为产品', reject: '拒绝', saveAttributes: '保存属性',
      noImage: '暂无图片', imageNeeded: '需要图片素材', supplierHidden: '当前角色不可查看供应商', supplierNotSet: '未设置供应商', imagePending: '供应商图片证据待补充', smartDetect: '智能识别', createNewProduct: '创建新产品', updateExisting: '更新现有产品', addNewVariant: '添加为新变体', ignore: '忽略', requiredRecognized: '必需字段已识别'
    },
    units: { companies: '{{count}}家公司' }
  },
  access: {
    title: '当前角色无权访问', body: '你的{{role}}角色不包含“{{module}}”权限。如工作职责已调整，请联系老板或管理员。',
    back: '返回数据看板', loadError: '页面加载失败', genericError: '暂时无法加载此页面，请重试。'
  }
};
