export default {
  meta: { name: 'English', htmlLang: 'en' },
  common: {
    workspace: 'Workspace', growth: 'Growth', system: 'System', searchWorkspace: 'Search workspace',
    searchPlaceholder: 'Search pages, products, or opportunities…', pages: 'Pages', navigate: 'Navigate', open: 'Open',
    view: 'View', browseAll: 'Browse all', filter: 'Filter', retry: 'Try again', moreActions: 'More actions',
    all: 'All', none: 'None', notYet: 'Not yet', dueToday: 'Due today', dueTomorrow: 'Due tomorrow',
    friday: 'Friday', yesterday: 'Yesterday', language: 'Language', signedInAs: 'Signed in as', noMatches: 'No matching pages.', actionNoted: 'Action noted.',
    edit: 'Edit', close: 'Close', cancel: 'Cancel', save: 'Save'
  },
  roles: { Admin: 'Admin', Owner: 'Owner', Sales: 'Sales', Designer: 'Designer', VA: 'VA' },
  nav: {
    newInquiry: '+ New Inquiry', salesCustomers: 'Customers', salesQuotes: 'Quotes', salesOrders: 'Orders', salesTasks: 'Tasks',
    dashboard: 'Dashboard', products: 'Product Knowledge Center', knowledgeDashboard: 'Knowledge Dashboard', opportunityIntelligence: 'Opportunity Intelligence', imports: 'Product Import Center', images: 'AI Image Center',
    proposals: 'Proposal Builder', cases: 'Project Case Library', crm: 'Opportunity CRM', salesAi: 'AI Sales Center',
    contentAi: 'AI Content Center', coreFoundation: 'Core Foundation Center', debugCenter: 'System Debug Center', settings: 'Settings'
  },
  login: {
    storyEyebrow: 'Built for hospitality projects', storyTitle: 'Turn furniture expertise into winning restaurant projects.',
    storyBody: 'One focused workspace for your sales, design, sourcing, and operations teams — powered by shared knowledge and practical AI.',
    proofTitle: 'One team. One source of truth.', proofBody: 'From first inquiry to production handoff.', kicker: 'Team workspace',
    welcome: 'Welcome back', subtitle: 'Sign in to continue to your workspace.', email: 'Email address', password: 'Password',
    signIn: 'Sign in to workspace', signingIn: 'Signing in…', demoRoles: 'Demo roles', demoPassword: 'All demo accounts use',
    privateWorkspace: 'Private company workspace · Authorized team members only', showPassword: 'Show password', hidePassword: 'Hide password',
    invalidCredentials: 'Email or password is incorrect.'
  },
  shell: {
    supportTitle: 'Need help?', supportBody: 'Visit the team guide', notifications: 'Notifications', allCaughtUp: 'You’re all caught up.',
    accountMenu: 'Account menu', myProfile: 'My profile', signOut: 'Sign out', profileNext: 'Profile editing is ready for the next release.'
  },
  fields: {
    opportunity: 'Opportunity', stage: 'Stage', value: 'Value', owner: 'Owner', nextAction: 'Next action', product: 'Product',
    sku: 'SKU', productName: 'Product Name', category: 'Category', material: 'Material', size: 'Size', priceRange: 'Price Range',
    leadTime: 'Lead Time', moq: 'MOQ', tags: 'Tags', status: 'Status', file: 'File', startedBy: 'Started by', rows: 'Rows',
    imported: 'Imported', issues: 'Issues', client: 'Client', market: 'Market', validUntil: 'Valid until', teamMember: 'Team member',
    role: 'Role', lastActive: 'Last active', module: 'Module', projectPrompt: 'Project prompt', spaceType: 'Space type',
    aspectRatio: 'Aspect ratio', visualDirection: 'Visual direction', organization: 'Organization'
  },
  status: {
    newLead: 'New Lead', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', won: 'Won', lost: 'Lost',
    approved: 'Approved', review: 'Review', draft: 'Draft', archived: 'Archived', completed: 'Completed', failed: 'Failed',
    queued: 'Queued', validating: 'Validating', internalReview: 'Internal Review', sent: 'Sent', published: 'Published',
    active: 'Active', inactive: 'Inactive', invited: 'Invited', disabled: 'Disabled', idea: 'Idea', ready: 'Ready', generating: 'Generating'
  },
  dashboard: {
    greeting: 'Good morning, {{name}}', subtitleAll: 'Here’s what’s happening across your restaurant furniture business today.',
    subtitleSales: 'Here’s what’s happening across your sales pipeline today.', openPipeline: 'Open pipeline', activeOpportunities: 'Active opportunities',
    acrossStages: 'Across 4 stages', proposalsInProgress: 'Proposals in progress', dueThisWeek: '2 due this week',
    salesReadyProducts: 'Sales-ready products', addedThisMonth: '+8 this month', priorityPipeline: 'Priority pipeline',
    priorityPipelineSub: 'Opportunities most likely to need attention', viewCrm: 'View CRM', noOpportunities: 'No opportunities yet.',
    recentProductActivity: 'Recent product activity', recentProductActivitySub: 'Latest additions to the knowledge center', openProducts: 'Open products',
    productApproved: 'Harbor Ash Dining Chair approved', productApprovedMeta: 'Product Knowledge · 18 minutes ago', specUpdated: 'Booth specification sheet updated',
    specUpdatedMeta: 'Linework Modular Booth · 2 hours ago', importCompleted: 'Outdoor collection import completed', importCompletedMeta: '146 products imported · Yesterday',
    readiness: 'Workspace readiness', readinessSub: 'Core business knowledge coverage', foundation: 'Strong foundation',
    foundationSub: 'Complete product data to improve AI outputs and proposals.', specifications: 'Product specifications', caseCoverage: 'Project case coverage',
    salesPlaybooks: 'Sales playbooks', myFocus: 'My focus', myFocusSub: 'Tasks needing your attention', reviewFinish: 'Review Austin finish board',
    confirmFreight: 'Confirm Sierra freight estimate', approveCopy: 'Approve case study copy', aiSignal: 'AI opportunity signal',
    signalTitle: 'Three warm opportunities have had no contact in 7+ days.', signalBody: 'A short, project-specific follow-up could bring $118K in pipeline back into motion.',
    draftFollowups: 'Draft follow-ups', taskComplete: 'Task marked complete.', taskReopened: 'Task reopened.'
  },
  products: {
    title: 'Product Knowledge Center', subtitle: 'The team’s trusted source for product specifications, materials, and sales knowledge.',
    add: 'Add product', library: 'Product library', librarySub: '{{count}} products · Structured for sales, proposals, and AI',
    search: 'Search product, SKU, or tag…', allCategories: 'All categories', allStatuses: 'All statuses', allTags: 'All tags', days: '{{count}} days',
    addTitle: 'Add product', editTitle: 'Edit product', skuStyle: 'SKU style', skuHelp: 'SKU format: category-style-sequence, for example BS-CA-001.',
    autoGenerated: 'Generated automatically', generate: 'Generate', summary: 'Summary', saved: 'Product saved.', duplicateSku: 'This SKU is already in use.',
    nextBuild: 'Product creation form is scoped for the next build.'
  },
  intelligence: {
    libraryStatus: 'Product Intelligence Status', libraryStatusSub: 'Proposal readiness across the shared product source of truth',
    totalProducts: 'Total Products', proposalReadyProducts: 'Proposal Ready Products', productsNeedReview: 'Products Need Review', missingImages: 'Missing Images', missingPrice: 'Missing Price', missingAiTags: 'Missing AI Tags',
    allCategories: 'All categories', allBudgetLevels: 'All budget levels', allReadiness: 'All readiness statuses', aiTags: 'AI Tags', readinessScore: 'Product Readiness Score', proposalStatus: 'Proposal Ready Status', readinessSummary: '80 points or higher is Proposal Ready.',
    subCategory: 'Sub Category', productSeries: 'Product Series', color: 'Color', finish: 'Finish', budgetLevel: 'Budget Level', recommendedUsage: 'Recommended Usage',
    generateProductInfo: 'Generate AI Product Info', generatedReview: 'Rule-generated content is ready for human review. Save when approved.', productProfile: 'Product Intelligence Profile', productProfileSub: 'Shared commercial, proposal, and sales knowledge for every downstream module.',
    englishDescription: 'English Product Description', shortSalesDescription: 'Short Sales Description', salesNotes: 'Sales Notes', salesTalkingPoints: 'Sales Talking Points', commonQuestions: 'Common Questions', commonObjections: 'Common Objections', proposalUsageNotes: 'Proposal Usage Notes',
    productImages: 'Product Image Management', productImagesSub: 'Manage approved product views and reserved AI image entries.', uploadImage: 'Upload Product Image', addAiImage: 'Add AI Generated Image', markMain: 'Mark as Main Image', linkExistingMedia: 'Link existing media', imageEntryNote: 'This phase stores image metadata and URLs; AI generation is reserved but not connected.', imageType: 'Image Type', imageStatus: 'Image Status', imageSaved: 'Product image saved.',
    relatedCategories: 'Related Categories', relatedCategoriesSub: 'Shared category relationships for discovery, proposals, and future APIs.', seoGeo: 'SEO / GEO', seoGeoSub: 'Reusable website, search, LLM, and knowledge-answering content.',
    generateSeo: 'Generate SEO', generateGeo: 'Generate GEO', generateFaq: 'Generate FAQ', generateBuyingGuide: 'Generate Buying Guide', seoTitle: 'SEO Title', seoDescription: 'SEO Description', metaKeywords: 'Meta Keywords', slug: 'Slug', canonicalUrl: 'Canonical URL', imageAlt: 'Image Alt', imageCaption: 'Image Caption', productKeywords: 'Product Keywords',
    llmSummary: 'LLM Summary', useCases: 'Use Cases', bestFor: 'Best For', notRecommendedFor: 'Not Recommended For', comparison: 'Comparison', advantages: 'Advantages', disadvantages: 'Disadvantages', faq: 'FAQ', buyingGuide: 'Buying Guide', installationGuide: 'Installation Guide', maintenanceGuide: 'Maintenance Guide', commonProblems: 'Common Problems', suggestedPrompt: 'Suggested Prompt'
  },
  factory: {
    title: 'AI Content Factory', subtitle: 'Turn one approved product image into reviewable product, sales, SEO, GEO, proposal, and image-task drafts.',
    generateEverything: 'Generate Everything', sourceImage: 'Source Image', generationMode: 'Generation Mode', fast: 'Fast Mode', standard: 'Standard Mode', premium: 'Premium Mode',
    fastHelp: 'Text content only · estimated text cost $0.01', standardHelp: 'Text plus 3 image tasks · $0.05 per image task', premiumHelp: 'Text plus 14 image tasks · $0.15 per image task',
    generatedDraft: 'Generated Content Draft', imageTasks: 'Image Generation Tasks', reviewStatus: 'Review Status', noContent: 'No AI Content', draftGenerated: 'Draft Generated', pendingReview: 'Pending Review', approved: 'Approved', rejected: 'Rejected', applied: 'Applied',
    analyze: 'Image analysis', descriptionEn: 'English Description', descriptionZh: 'Chinese Description', shortSales: 'Short Sales Description', seoTitle: 'SEO Title', seoDescription: 'SEO Description', metaKeywords: 'Meta Keywords', llmSummary: 'LLM Summary', faq: 'FAQ', buyingGuide: 'Buying Guide', salesPoints: 'Sales Talking Points', proposalNotes: 'Proposal Notes', aiTags: 'AI Tags', styles: 'Styles', storeTypes: 'Store Types', reviewNotes: 'Review Notes',
    saveDraft: 'Save Draft', approveDraft: 'Approve Draft', rejectDraft: 'Reject Draft', applyProduct: 'Apply to Product', viewDraft: 'View AI Draft', editDraft: 'Edit Draft',
    sourceRequired: 'Upload or approve a product image in the Media tab before generating.', generated: 'Draft and image tasks created for review.', saved: 'AI content draft saved.', reviewed: 'Review decision saved.', appliedMessage: 'Approved content applied to Product Intelligence Center.',
    mode: 'Mode', provider: 'Provider', taskType: 'Task Type', scene: 'Scene', cost: 'Estimated Cost', status: 'Status', noTasks: 'No image tasks for this mode.', totalCost: 'Estimated total', humanReview: 'No generated content overwrites the product until approval and Apply to Product.',
    debugTitle: 'AI Product Factory Status', totalDrafts: 'Total Drafts', appliedDrafts: 'Applied Drafts', imageTaskCount: 'Image Tasks', pendingImageTasks: 'Pending Image Tasks', failedImageTasks: 'Failed Image Tasks'
  },
  imageGeneration: {
    title: 'AI Image Generation', providerStatus: 'Provider Status', currentProvider: 'Current Provider', available: 'Provider Available', apiKey: 'API Key Configured', model: 'Model', maxPerRun: 'Max Per Run', size: 'Image Size', fallback: 'Fallback',
    runSelected: 'Run Selected Tasks', runAll: 'Run All Pending Tasks', runTask: 'Run', retry: 'Retry Failed Task', cancel: 'Cancel Task', preview: 'Preview Generated Image', approve: 'Approve Image', reject: 'Reject Image', apply: 'Apply Image to Product', savePrompt: 'Save Prompt', prompt: 'Prompt Editor', negativePrompt: 'Negative Prompt', reviewNotes: 'Review Notes',
    confirmRun: 'Confirm image generation and estimated provider cost?', selectedRequired: 'Select at least one pending image task.', runComplete: 'Image generation run completed.', taskUpdated: 'Image task updated.', reviewSaved: 'Image review saved.', imageApplied: 'Approved image added to the product media library.',
    outputPreview: 'Output Preview', requestId: 'Provider Request ID', dimensions: 'Dimensions', confidence: 'AI Confidence', started: 'Started', completed: 'Completed', lastError: 'Last Error',
    totalTasks: 'Total Tasks', pendingTasks: 'Pending Tasks', runningTasks: 'Running Tasks', generatedTasks: 'Generated Tasks', failedTasks: 'Failed Tasks', approvedTasks: 'Approved Tasks', appliedTasks: 'Applied Tasks', debugTitle: 'AI Image Generation Status'
  },
  knowledge: {
    title: 'Knowledge Dashboard', subtitle: 'Measure and improve the product intelligence used by sales, proposals, recommendations, and future AI workflows.',
    completion: 'Knowledge Completion', scoreSummary: '{{count}} products measured across six knowledge signals', withImages: 'Products with media', withSizes: 'Products with dimensions', withCases: 'Products with cases', openDashboard: 'Open Knowledge Dashboard',
    averageScore: 'Knowledge Score', products: 'Products', activeLibrary: 'Active product library', missingImages: 'Missing images', missingSizes: 'Missing sizes', missingCases: 'Missing cases', needsAttention: 'Needs attention',
    top100: 'Knowledge Top 100', top100Sub: 'Highest-completeness products ready for reuse', incomplete: 'Knowledge Incomplete', incompleteSub: 'Products requiring additional knowledge', score: 'Knowledge Score', media: 'Media', cases: 'Cases', related: 'Related', open: 'Open', openProducts: 'Open products',
    keywordSearch: 'Keyword, product, AI summary…', allStoreTypes: 'All store types', allStyles: 'All styles', allFeatures: 'All features', clear: 'Clear', storeTypes: 'Store types', styles: 'Styles',
    saveKnowledge: 'Save knowledge', backProducts: 'Back to products', completeness: 'Knowledge completeness', scoreOutOf100: '{{score}} out of 100', missing: 'Missing: {{items}}', complete: 'Knowledge record is complete.', notSet: 'Not set',
    knowledgeTab: 'Knowledge', mediaTab: 'Media', relatedProducts: 'Related Products', relatedCases: 'Related Cases', suitableStoreTypes: 'Suitable Store Types', suitableStyles: 'Suitable Styles', multiSelect: 'Select every relevant option.',
    features: 'Product Features', featureSub: 'Operational and recommendation signals.', customerTypes: 'Target Customers', customerSub: 'CRM-ready customer-fit signals.', aiReady: 'AI Ready', aiReadySub: 'Structured fields are stored now; no AI provider is connected.',
    aiSummary: 'AI Summary', aiKeywords: 'AI Keywords', aiSearchKeywords: 'AI Search Keywords', knowledgePrompt: 'Knowledge Prompt', aiNotes: 'AI Notes', internalNotes: 'Internal Notes', recommendationWeight: 'AI Recommendation Weight',
    mediaLibrary: 'Product Media', mediaSub: 'Link verified media metadata to this product.', noMedia: 'No active media records are available.', recommendedProducts: 'Recommended Products', recommendedSub: 'Products proposed as commercial matches.', aiRelatedProducts: 'AI Related Products', aiRelatedSub: 'Reserved relationship set for future AI workflows.',
    usedInProjects: 'Used in Projects', casesSub: 'Published project cases using this product.', noCases: 'No published cases are available.', saved: 'Product knowledge saved.'
  },
  imports: {
    title: 'Product Import Center', subtitle: 'Validate and bring supplier product data into one clean, structured knowledge base.',
    newImport: 'New import', dropTitle: 'Drop a product file here', dropBody: 'Excel or CSV · Up to 10 MB', browseFiles: 'Browse files',
    checklist: 'Import checklist', checklistSub: 'Prepare a clean file for fewer validation issues', template: 'Use the provided field template',
    templateSub: 'Required columns and accepted formats', oneRow: 'Keep one product per row', oneRowSub: 'Use SKU as the unique identifier',
    reviewFlagged: 'Review flagged data before publishing', reviewFlaggedSub: 'Nothing enters the knowledge center automatically',
    history: 'Import history', historySub: 'Recent product data jobs and validation results', toReview: '{{count}} to review',
    integrationReady: 'File validation workflow is ready for storage integration.'
  },
  images: {
    title: 'AI Image Center', subtitle: 'Create project-ready furniture and hospitality visuals from structured product knowledge.',
    viewLibrary: 'View image library', createScene: 'Create a project scene', createSceneSub: 'Describe the space, mood, and product placement.',
    promptPlaceholder: 'A refined 80-seat coastal restaurant in Miami, warm evening light, featuring the Harbor Ash Dining Chair…',
    restaurantDining: 'Restaurant dining room', outdoorPatio: 'Outdoor patio', hotelRestaurant: 'Hotel restaurant', cafe: 'Café',
    presentation: '16:9 Presentation', proposalFormat: '4:3 Proposal', social: '1:1 Social', photoreal: 'Photoreal', editorial: 'Editorial', concept: 'Concept',
    generate: 'Generate concept', placeholderTitle: 'Your project concept will appear here', placeholderBody: 'Use product-specific names and a clear hospitality setting for stronger, commercially useful results.',
    productAware: 'Product-aware scenes', productAwareBody: 'Reference approved SKUs so visuals stay anchored to known products.',
    proposalReady: 'Proposal-ready formats', proposalReadyBody: 'Generate landscape images that fit directly into client proposals.',
    brandSafe: 'Brand-safe outputs', brandSafeBody: 'Keep visual direction consistent with your B2B presentation standards.',
    integrationReady: 'Image workflow is ready for an AI provider connection.'
  },
  proposals: {
    title: 'Proposal Builder', subtitle: 'Build polished, product-accurate B2B project proposals with your team.', newProposal: 'New proposal',
    templateEyebrow: 'Start from a template', fullTitle: 'Full Project Proposal', fullBody: 'Product selection · Project story · Terms', mostUsed: 'Most used',
    selectionTitle: 'Product Selection Deck', selectionBody: 'Curated products · Finishes · Specifications', designLed: 'Design-led',
    quickTitle: 'Quick Budgetary Offer', quickBody: 'Short format · Fast turnaround · Clear scope', salesReady: 'Sales-ready', useTemplate: 'Use template',
    recent: 'Recent proposals', recentSub: '{{count}} proposals visible to your role', editorReady: 'Proposal workspace is ready for editor integration.',
    pdfLanguage: 'Customer PDF language', pdfEnglish: 'English (default for U.S. clients)'
  },
  cases: {
    title: 'Project Case Library', subtitle: 'Turn completed projects into reusable proof for sales conversations and proposals.', add: 'Add project case',
    search: 'Search cases by project or market…', allVenueTypes: 'All venue types', restaurant: 'Restaurant', hotel: 'Hotel', outdoor: 'Outdoor',
    allMarkets: 'All markets', unitedStates: 'United States', canada: 'Canada', publishedCase: 'Published case', viewCase: 'View case',
    productFamilies: '{{count}} product families', coverage: 'Case library coverage', coverageSub: 'Sales proof by venue type',
    restaurants: 'Restaurants', cafes: 'Cafés', hotels: 'Hotels', nextBuild: 'Project case creation is ready for the next build.'
  },
  crm: {
    title: 'Opportunity CRM', subtitleAll: 'A clear team view of every restaurant furniture opportunity and next action.',
    subtitleSales: 'Your restaurant furniture opportunities, next actions, and project momentum.', add: 'Add opportunity', active: '{{count}} active',
    weighted: 'Weighted pipeline', probabilityAdjusted: 'Probability adjusted', proposalStage: 'Proposal stage', needsFollowup: 'Needs follow-up',
    wonPeriod: 'Won this period', teamResult: 'Team result', nextBuild: 'Opportunity creation is ready for the next build.'
  },
  salesAi: {
    title: 'AI Sales Center', subtitle: 'Practical AI tools grounded in your products, cases, and active opportunities.', playbooks: 'Sales playbooks',
    brief: 'Opportunity Brief', briefBody: 'Turn CRM context into a concise pre-call brief with project risks, priorities, and recommended questions.', createBrief: 'Create brief',
    followup: 'Follow-up Writer', followupBody: 'Draft warm, specific follow-ups using the client’s project, stage, and next action.', draftFollowup: 'Draft follow-up',
    recommender: 'Product Recommender', recommenderBody: 'Match a hospitality brief with approved products and explain the commercial fit.', recommend: 'Recommend products',
    objection: 'Objection Coach', objectionBody: 'Prepare confident answers to common lead-time, customization, freight, and quality objections.', openCoach: 'Open coach',
    notes: 'Meeting Notes', notesBody: 'Structure raw notes into decisions, next steps, product requirements, and CRM updates.', processNotes: 'Process notes',
    research: 'Account Research', researchBody: 'Create a focused research plan for restaurant groups, designers, and hospitality operators.', startResearch: 'Start research',
    recommended: 'Recommended actions', recommendedSub: 'AI-detected sales moments based on your active pipeline', followPacific: 'Follow up with Pacific Venue Co.',
    followPacificMeta: 'No reply in 8 days · New Lead · $52K potential', prepareFreight: 'Prepare freight objection response',
    prepareFreightMeta: 'Sierra Table Group · Negotiation · Action due Monday', shortlist: 'Build a product shortlist for Maison & Marché',
    shortlistMeta: 'Qualified · Design call scheduled July 3', integrationReady: 'This AI tool is ready for model integration.'
  },
  contentAi: {
    title: 'AI Content Center', subtitle: 'Plan and create credible B2B content from your products, expertise, and project cases.', create: 'Create content',
    linkedin: 'LinkedIn Post', linkedinBody: 'Turn a project, material insight, or sales lesson into a concise professional post.', startPost: 'Start post',
    caseStory: 'Case Study Story', caseStoryBody: 'Create structured project copy with challenge, solution, product, and outcome.', buildStory: 'Build story',
    buyerGuide: 'Buyer Guide', buyerGuideBody: 'Package product knowledge into a useful guide for restaurant operators and designers.', createGuide: 'Create guide',
    calendar: 'Content calendar', calendarPeriod: 'June 29 – July 5, 2026', fullCalendar: 'View full calendar', integrationReady: 'Content workflow is ready for model integration.'
  },
  foundation: {
    title: 'Core Foundation Center', subtitle: 'Manage shared configuration, tags, media references, and AI prompt foundations for every business module.',
    configs: 'Config Center', configsSub: '{{count}} shared configuration options', tags: 'Tag Center', tagsSub: '{{count}} reusable system tags',
    media: 'Media Center', mediaSub: '{{count}} media references', prompts: 'Prompt Center', promptsSub: '{{count}} managed prompt templates',
    add: 'Add item', search: 'Search this list…', typeFilter: 'Filter by type', allTypes: 'All types', allStatuses: 'All statuses',
    readOnly: 'Read-only access', sectionLimited: 'This section is limited for your role', sectionLimitedBody: 'You can still use the configuration and tag foundations available to your role.',
    noMatches: 'No matching records', adjustFilters: 'Try another search, type, or status filter.', name: 'Name', tagName: 'Tag name', promptName: 'Prompt name',
    code: 'Code', type: 'Type', description: 'Description', sortOrder: 'Sort order', fileName: 'File name', fileType: 'File type',
    mediaCategory: 'Media category', relatedTo: 'Related to', flags: 'Flags', fileUrl: 'File URL', storageProvider: 'Storage provider',
    relatedModule: 'Related module', relatedRecordId: 'Related record ID', usageNote: 'Usage note', verified: 'Verified', aiGenerated: 'AI generated',
    version: 'Version', variables: 'Variables', promptContent: 'Prompt content', addTitle: 'Add foundation item', editTitle: 'Edit foundation item',
    activate: 'Activate item', deactivate: 'Deactivate item', saved: 'Foundation item saved.', duplicate: 'That name or code is already in use.'
  },
  debug: {
    title: 'System Debug Center', subtitle: 'Inspect application health, database readiness, runtime resources, and recent system events.',
    refresh: 'Refresh diagnostics', refreshed: 'Diagnostics refreshed.', healthy: 'Healthy', connected: 'Connected', verified: 'Verified', missing: 'Missing', error: 'Error',
    http: 'HTTP service', database: 'Database', migration: 'Migration', uptime: 'Uptime', tableCount: '{{count}} tables',
    runtime: 'Runtime details', runtimeSub: 'Current server process and deployment context', environment: 'Environment', platform: 'Platform', process: 'Process', memory: 'Memory', commit: 'Commit',
    tables: 'Database tables', tablesSub: '{{count}} tables discovered', events: 'Recent system events', eventsSub: 'Latest startup and database activity', latestError: 'Latest database error', noEvents: 'No system events recorded.'
  },
  settings: {
    title: 'Settings', subtitle: 'Manage your organization, team access, and workspace standards.', invite: 'Invite team member',
    teamMembers: 'Team members', teamSub: '{{count}} people have access to this workspace', rolesPermissions: 'Roles & permissions',
    organization: 'Organization', defaults: 'Workspace defaults', accessOverview: 'Role access overview',
    accessOverviewSub: 'Module visibility is enforced by the server and reflected in navigation', inviteReady: 'Team invitations are ready for email provider integration.'
  },
  access: {
    title: 'Access is limited for your role', body: 'Your {{role}} role does not include {{module}}. Ask an Owner or Admin if your responsibilities have changed.',
    back: 'Back to dashboard', loadError: 'We couldn’t load this page', genericError: 'The page could not be loaded. Please try again.'
  }
};
