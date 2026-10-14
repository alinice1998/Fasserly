class TinyMCPClient {
    constructor(url) {
        this.originalUrl = url;
        this.proxy = (u) => {
            if (window.location.protocol === 'https:' && typeof u === 'string') {
                return u.replace(/^http:\/\/[^/]+/, window.location.origin);
            }
            return u;
        };
        this.url = this.proxy(url);
        this.messageId = 1;
        this.resolvers = new Map();
        this.es = null;
        this.postEndpoint = null;
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            this.es = new EventSource(this.url);
            
            this.es.addEventListener('endpoint', (e) => {
                // e.data contains the endpoint url for POST requests
                const absoluteEndpoint = new URL(e.data, this.originalUrl).href;
                this.postEndpoint = this.proxy(absoluteEndpoint);
                
                // Initialize request
                this.send('initialize', {
                    protocolVersion: "2024-11-05",
                    capabilities: {},
                    clientInfo: { name: "tafsir-web", version: "1.0.0" }
                }).then(() => {
                    this.notify('notifications/initialized').then(resolve).catch(resolve);
                }).catch(reject);
            });
            
            this.es.addEventListener('message', (e) => {
                const msg = JSON.parse(e.data);
                if (msg.id && this.resolvers.has(msg.id)) {
                    if (msg.error) {
                        this.resolvers.get(msg.id).reject(new Error(msg.error.message));
                    } else {
                        this.resolvers.get(msg.id).resolve(msg.result);
                    }
                    this.resolvers.delete(msg.id);
                }
            });
            
            this.es.onerror = (err) => {
                if (!this.postEndpoint) {
                    this.es.close();
                    reject(new Error("EventSource Connection Failed"));
                }
            };
        });
    }
    
    async send(method, params = {}) {
        const id = this.messageId++;
        const promise = new Promise((resolve, reject) => {
            this.resolvers.set(id, { resolve, reject });
        });
        
        await fetch(this.postEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: id,
                method: method,
                params: params
            })
        });
        
        return promise;
    }
    
    async notify(method, params = {}) {
        await fetch(this.postEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: method,
                params: params
            })
        });
    }

    async listTools() {
        return await this.send('tools/list');
    }
    
    async callTool({ name, arguments: args }) {
        return await this.send('tools/call', { name: name, arguments: args });
    }
}

// DOM Elements
const providerSelect = document.getElementById('provider-select');
const apiKeyLabel = document.getElementById('api-key-label');
const apiKeyHint = document.getElementById('api-key-hint');
const apiKeyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model-select');
const saveBtn = document.getElementById('save-settings-btn');
const statusDot = document.getElementById('mcp-status-dot');
const statusText = document.getElementById('mcp-status-text');
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const toastEl = document.getElementById('toast');

// Navigation & Sidebar Drawer Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const headerSettingsBtn = document.getElementById('header-settings-btn');
const headerClearBtn = document.getElementById('header-clear-btn');

// Modal Elements
const settingsModal = document.getElementById('settings-modal');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const toggleApiKeyBtn = document.getElementById('toggle-api-key-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');

// Providers & Models Configuration
const PROVIDERS = {
    google: {
        id: 'google',
        name: 'Google AI Studio',
        label: 'Google AI Studio (Gemini - مباشر ومجاني)',
        keyLabel: 'مفتاح Google AI Studio API Key',
        keyPlaceholder: 'AIzaSy...',
        keyHint: 'المفتاح آمن ويحفظ محليًا في متصفحك فقط للاتصال بالذكاء الاصطناعي. يمكنك استخراجه مجانًا من aistudio.google.com',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        defaultModel: 'gemini-3.5-flash-lite',
        models: [
            { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (الافتراضي - فائق السرعة)' },
            { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (متوازن ومتقدم)' },
            { id: 'gemini-4-argon', name: 'Gemini 4 Argon (النموذج الأقوى والأعلى ذكاءً)' }
        ]
    },
    openrouter: {
        id: 'openrouter',
        name: 'OpenRouter',
        label: 'OpenRouter (نماذج متعددة)',
        keyLabel: 'مفتاح OpenRouter API Key',
        keyPlaceholder: 'sk-or-v1-...',
        keyHint: 'المفتاح آمن ويحفظ محليًا في متصفحك فقط للاتصال بالذكاء الاصطناعي عبر منصة OpenRouter.',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        defaultModel: 'google/gemini-3.5-flash-lite',
        models: [
            { id: 'google/gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (الافتراضي - فائق السرعة)' },
            { id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash (متوازن ومتقدم)' },
            { id: 'google/gemini-4-argon', name: 'Gemini 4 Argon (النموذج الأقوى والأعلى ذكاءً)' }
        ]
    }
};

// State
let googleApiKey = localStorage.getItem('googleApiKey') || '';
let openRouterApiKey = localStorage.getItem('openRouterApiKey') || '';

let selectedProvider = localStorage.getItem('fasserly_provider');
if (!selectedProvider || !PROVIDERS[selectedProvider]) {
    if (openRouterApiKey && !googleApiKey) {
        selectedProvider = 'openrouter';
    } else {
        selectedProvider = 'google';
    }
    localStorage.setItem('fasserly_provider', selectedProvider);
}

let selectedGoogleModel = localStorage.getItem('selectedGoogleModel');
const validGoogleModels = PROVIDERS.google.models.map(m => m.id);
if (!selectedGoogleModel || !validGoogleModels.includes(selectedGoogleModel)) {
    selectedGoogleModel = PROVIDERS.google.defaultModel;
    localStorage.setItem('selectedGoogleModel', selectedGoogleModel);
}

let selectedOpenRouterModel = localStorage.getItem('selectedOpenRouterModel') || localStorage.getItem('selectedModel');
const validOpenRouterModels = PROVIDERS.openrouter.models.map(m => m.id);
if (!selectedOpenRouterModel || !validOpenRouterModels.includes(selectedOpenRouterModel)) {
    selectedOpenRouterModel = PROVIDERS.openrouter.defaultModel;
    localStorage.setItem('selectedOpenRouterModel', selectedOpenRouterModel);
}

function getActiveApiKey() {
    return selectedProvider === 'google' ? googleApiKey : openRouterApiKey;
}

function getActiveModel() {
    return selectedProvider === 'google' ? selectedGoogleModel : selectedOpenRouterModel;
}

let mcpClient = null;
let mcpTools = [];
let messages = [
    {
        role: "system",
        content: `أنت عالم مفسر وباحث متعمق في علوم القرآن الكريم والتفسير واللغة العربية في تطبيق (فَسِّرْلي).

مهمتك الأساسية هي الإجابة عن أسئلة المستخدمين حول آيات القرآن الكريم وتفسيرها، وأسباب نزولها، وإعجازها، وإعرابها النحوي واللغوي بدقة وأمانة تامة.

🔴 قواعد إجبارية صارمة لاستخدام أدوات البحث (Tafsir MCP):
1. يُحظر عليك حظرًا تامًا الإجابة عن أي سؤال يتعلق بالقرآن الكريم، آياته، سوره، تفسيره، إعرابه، كلماته، أسباب نزوله، قراءاته، إحصاءاته، أو الشبهات/المسائل المتعلقة به (مثل الأسئلة عن شبهة الأعداد، أو "سبعة وثامنهم"، أو الموت، أو السموات، أو أي ألفاظ/مسائل أخرى) من معلوماتك الذاتية (الذاكرة الداخلية) دون استدعاء أداة واحدة على الأقل من أدوات البحث المتوفرة لديك.
2. يجب عليك دائمًا وأولًا استخدام الأدوات المتاحة (Tafsir MCP) للبحث في المصادر والتفاسير المعتمدة قبل صياغة إجابتك. على سبيل المثال:
   - إذا سأل المستخدم عن آية أو موضوع أو لفظ أو قصة في القرآن، استخدم أداة search_quran_text أو search_in_tafsir للبحث عن الآيات والقصص المتعلقة بالسؤال أولًا.
   - إذا سأل المستخدم عن تفسير آية معينة، استخدم أداة fetch_tafsir.
   - إذا سأل المستخدم عن إعراب آية أو كلماتها، استخدم أداة fetch_ayah مع تضمين الإعراب، أو أداة analyze_word.
   - إذا سأل المستخدم عن إحصاءات عامة أو خاصة بسورة، استخدم أداة get_quran_overview أو get_surah_statistics.
3. الاستثناء الوحيد لاستدعاء الأدوات هو التحيات والترحيبات العامة (مثل: "السلام عليكم"، "أهلاً"، "مرحباً"، "كيف حالك") أو الأسئلة التقنية/الإدارية حول التطبيق نفسه، حيث يمكنك الإجابة عليها مباشرة وبسرعة دون استخدام الأدوات.
4. يمنع منعًا باتًا الإجابة عن الأسئلة القرآنية مباشرة من ذاكرتك الداخلية بحجة أنك "تعرف الإجابة" أو "الإجابة واضحة". يجب أن تكون إجابتك مدعومة ومسندة بالكامل بالمعلومات المستخرجة من الأدوات في نفس المحادثة.
5. لا تقم أبدًا باختلاق آية أو تفسير أو نسبة أثر غير صحيح. إذا لم تجد المعلومة بعد البحث المكثف عبر الأدوات، قل بأدب: "لم أجد معلومات موثقة حول هذا السؤال في قاعدة البيانات الحالية" أو اطلب من المستخدم توضيح كلماته.
6. عند الاستشهاد بآية قرآنية أو كتابتها داخل إجابتك، يرجى كتابتها مستقلة داخل كتلة اقتباس (Markdown Blockquote، أي مسبوقة بـ ">") لتظهر بتنسيقها الجمالي الكلاسيكي المخصص في التطبيق.
7. تحدث باللغة العربية الفصحى دائمًا بوقار لغوي، وبأسلوب رفيع ومحترم يليق بجلال القرآن الكريم وعلومه الشريفة.`
    }
];

// UI Synchronization for Provider
function renderProviderSettings(providerKey) {
    const config = PROVIDERS[providerKey] || PROVIDERS.google;
    if (apiKeyLabel) apiKeyLabel.textContent = config.keyLabel;
    if (apiKeyInput) {
        apiKeyInput.placeholder = config.keyPlaceholder;
        apiKeyInput.value = (providerKey === 'google' ? googleApiKey : openRouterApiKey);
    }
    if (apiKeyHint) apiKeyHint.textContent = config.keyHint;
    
    if (modelSelect) {
        modelSelect.innerHTML = '';
        const currentModel = (providerKey === 'google' ? selectedGoogleModel : selectedOpenRouterModel);
        config.models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            if (m.id === currentModel) {
                opt.selected = true;
            }
            modelSelect.appendChild(opt);
        });
    }
}

// Initialize UI
const welcomeApiAlert = document.getElementById('welcome-api-alert');
if (providerSelect) {
    providerSelect.value = selectedProvider;
    providerSelect.addEventListener('change', (e) => {
        renderProviderSettings(e.target.value);
    });
}
renderProviderSettings(selectedProvider);

if (getActiveApiKey()) {
    if (welcomeApiAlert) {
        welcomeApiAlert.style.display = 'none';
    }
}

// Show toast message
function showToast(message, type = 'success') {
    toastEl.innerHTML = '';
    const icon = document.createElement('i');
    
    if (type === 'success') {
        toastEl.className = 'toast success-toast';
        icon.className = 'fa-solid fa-circle-check';
        icon.style.color = 'var(--color-gold)';
        icon.style.marginLeft = '10px';
    } else {
        toastEl.className = 'toast error-toast';
        icon.className = 'fa-solid fa-circle-xmark';
        icon.style.color = '#fca5a5';
        icon.style.marginLeft = '10px';
    }
    
    const textNode = document.createTextNode(message);
    toastEl.appendChild(icon);
    toastEl.appendChild(textNode);
    
    toastEl.classList.remove('hidden');
    setTimeout(() => toastEl.classList.add('hidden'), 4000);
}

// Modal Toggle Functions
function openModal() {
    settingsModal.classList.remove('hidden');
}

function closeModal() {
    settingsModal.classList.add('hidden');
}

// Append message to chat
function appendMessage(role, content, isHtml = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-mosque"></i>';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    
    if (isHtml) {
        contentDiv.innerHTML = content;
    } else {
        // Use marked if available, fallback to basic formatting
        if (typeof marked !== 'undefined') {
            contentDiv.innerHTML = marked.parse(content);
        } else {
            contentDiv.innerHTML = content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        }
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(contentDiv);
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return contentDiv;
}

function appendToolCallIndicator(toolName) {
    const toolNamesAr = {
        'fetch_ayah': 'البحث عن آية',
        'fetch_tafsir': 'البحث في التفاسير',
        'fetch_nuzool_reason': 'أسباب النزول',
        'fetch_surah_info': 'معلومات السورة',
        'analyze_word': 'تحليل كلمة',
        'find_root_occurrences': 'البحث عن الجذور',
        'get_root_stats': 'إحصاءات الجذور',
        'get_qeraat_variants': 'القراءات',
        'search_quran_text': 'البحث في القرآن',
        'search_in_tafsir': 'بحث في متن التفسير',
        'get_quran_overview': 'إحصاءات عامة',
        'get_page_fawaed': 'فوائد الصفحة',
        'get_surah_statistics': 'إحصاءات السورة'
    };
    const arName = toolNamesAr[toolName] || toolName;

    const indicator = document.createElement('div');
    indicator.className = 'message ai-message tool-indicator-msg';
    indicator.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-feather-pointed"></i></div>
        <div class="content" style="background: transparent; border: none; padding: 0; box-shadow: none; width: 100%;">
            <div class="tool-call-wrapper">
                <div class="tool-call">
                    <i class="fa-solid fa-spinner fa-spin"></i> جاري استخراج البيانات (${arName})...
                </div>
                <div class="tool-details-pane"></div>
            </div>
        </div>
    `;
    chatContainer.appendChild(indicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return indicator;
}

// Initialize MCP Connection
async function initMCP() {
    try {
        statusDot.className = 'status-dot';
        statusText.textContent = 'جاري الاتصال بخادم التفسير...';
        
        // تحديد مسار خادم Tafsir MCP تلقائياً (محلي أو عبر السيرفر الحي)
        const isRemote = window.location.protocol.startsWith('http') && 
                         window.location.hostname !== 'localhost' && 
                         window.location.hostname !== '127.0.0.1';
        const mcpUrl = isRemote ? `${window.location.origin}/sse` : 'http://localhost:8000/sse';
        mcpClient = new TinyMCPClient(mcpUrl);
        await mcpClient.connect();
        
        const toolsResult = await mcpClient.listTools();
        
        if (toolsResult && toolsResult.tools) {
            mcpTools = toolsResult.tools.map(tool => ({
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema
                }
            }));
        }

        statusDot.className = 'status-dot connected';
        statusText.textContent = `متصل بخادم التفسير (${mcpTools.length} أدوات بحث متوفرة)`;
        
        if (getActiveApiKey()) {
            userInput.disabled = false;
            sendBtn.disabled = false;
        }
    } catch (error) {
        console.error("MCP Connection Error:", error);
        mcpClient = null;
        statusDot.className = 'status-dot';
        statusText.textContent = 'فشل الاتصال بخادم التفسير';
        showToast('تعذر الاتصال بخادم التفسير (Tafsir MCP).', 'error');
    }
}

// Call AI Provider API (Google AI Studio or OpenRouter)
async function callLLM(requestMessages) {
    const provider = PROVIDERS[selectedProvider];
    const apiKey = getActiveApiKey();
    const model = getActiveModel();

    if (!apiKey) {
        throw new Error(`يرجى إدخال مفتاح الاتصال الخاص بـ ${provider.name} من الإعدادات.`);
    }

    const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
    };

    if (selectedProvider === 'openrouter') {
        headers["HTTP-Referer"] = window.location.href;
        headers["X-Title"] = "Fasserly Portal";
    }

    const payload = {
        model: model,
        messages: requestMessages,
        tools: mcpTools.length > 0 ? mcpTools : undefined,
        tool_choice: "auto"
    };

    const response = await fetch(provider.endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        let errMsg = `${provider.name} API Error (${response.status})`;
        try {
            const err = await response.json();
            errMsg = err.error?.message || err.message || JSON.stringify(err);
        } catch (e) {
            // failed to parse JSON error
        }
        throw new Error(errMsg);
    }

    return await response.json();
}

// Handle Tool Call Execution
async function executeToolCall(toolCall) {
    const args = JSON.parse(toolCall.function.arguments);
    console.log(`Executing tool ${toolCall.function.name}`, args);
    try {
        const result = await mcpClient.callTool({
            name: toolCall.function.name,
            arguments: args
        });
        
        let contentStr = '';
        if (result.content && result.content.length > 0) {
            contentStr = result.content.map(c => c.text).join('\\n');
        } else {
            contentStr = "لا يوجد نتائج";
        }
        
        return contentStr;
    } catch (err) {
        console.error(`Tool execution failed:`, err);
        return `حدث خطأ أثناء تنفيذ الأداة: ${err.message}`;
    }
}

// Handle the Send Button
async function handleSend() {
    const text = userInput.value.trim();
    if (!text) return;
    
    if (!getActiveApiKey()) {
        showToast('يرجى إدخال مفتاح الاتصال أولاً من الإعدادات!', 'error');
        openModal();
        return;
    }

    userInput.value = '';
    userInput.style.height = 'auto';
    userInput.disabled = true;
    sendBtn.disabled = true;
    
    appendMessage('user', text);
    messages.push({ role: 'user', content: text });

    let finalAnswerDiv = appendMessage('ai', '<i class="fa-solid fa-ellipsis fa-fade"></i>', true);

    try {
        let isComplete = false;
        
        while (!isComplete) {
            const data = await callLLM(messages);
            const messageObj = data.choices[0].message;
            
            messages.push(messageObj);

            if (messageObj.tool_calls && messageObj.tool_calls.length > 0) {
                finalAnswerDiv.parentElement.remove();
                
                for (const toolCall of messageObj.tool_calls) {
                    const indicator = appendToolCallIndicator(toolCall.function.name);
                    const toolResultText = await executeToolCall(toolCall);
                    
                    const toolCallDiv = indicator.querySelector('.tool-call');
                    if (toolCallDiv) {
                        const toolNamesAr = {
                            'fetch_ayah': 'البحث عن آية',
                            'fetch_tafsir': 'البحث في التفاسير',
                            'fetch_nuzool_reason': 'أسباب النزول',
                            'fetch_surah_info': 'معلومات السورة',
                            'analyze_word': 'تحليل كلمة',
                            'find_root_occurrences': 'البحث عن الجذور',
                            'get_root_stats': 'إحصاءات الجذور',
                            'get_qeraat_variants': 'القراءات',
                            'search_quran_text': 'البحث في القرآن',
                            'search_in_tafsir': 'بحث في متن التفسير',
                            'get_quran_overview': 'إحصاءات عامة',
                            'get_page_fawaed': 'فوائد الصفحة',
                            'get_surah_statistics': 'إحصاءات السورة'
                        };
                        const arName = toolNamesAr[toolCall.function.name] || toolCall.function.name;
                        toolCallDiv.innerHTML = `<i class="fa-solid fa-check"></i> تم استخراج البيانات (${arName}) <i class="fa-solid fa-chevron-down" style="font-size: 10px; margin-right: 6px; opacity: 0.8;"></i>`;
                        toolCallDiv.classList.add('clickable');
                        
                        const detailsPane = indicator.querySelector('.tool-details-pane');
                        if (detailsPane) {
                            let formattedArgs;
                            try {
                                formattedArgs = JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2);
                            } catch (e) {
                                formattedArgs = toolCall.function.arguments;
                            }
                            
                            detailsPane.innerHTML = `
                                <div class="tool-details-section">
                                    <div class="tool-details-title"><i class="fa-solid fa-gears"></i> معلمات البحث (Arguments):</div>
                                    <pre class="tool-details-code">${formattedArgs}</pre>
                                </div>
                                <div class="tool-details-section">
                                    <div class="tool-details-title"><i class="fa-solid fa-database"></i> البيانات المسترجعة (Result):</div>
                                    <div class="tool-details-result">${toolResultText}</div>
                                </div>
                            `;
                            
                            toolCallDiv.addEventListener('click', () => {
                                const isHidden = window.getComputedStyle(detailsPane).display === 'none';
                                detailsPane.style.display = isHidden ? 'block' : 'none';
                                const icon = toolCallDiv.querySelector('.fa-chevron-down, .fa-chevron-up');
                                if (icon) {
                                    icon.className = isHidden ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
                                }
                            });
                        }
                    }
                    
                    messages.push({
                        role: "tool",
                        name: toolCall.function.name,
                        tool_call_id: toolCall.id,
                        content: toolResultText
                    });
                }
                
                finalAnswerDiv = appendMessage('ai', '<i class="fa-solid fa-ellipsis fa-fade"></i>', true);
            } else {
                isComplete = true;
                if (typeof marked !== 'undefined') {
                    finalAnswerDiv.innerHTML = marked.parse(messageObj.content);
                } else {
                    finalAnswerDiv.innerHTML = messageObj.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                }
            }
        }
    } catch (error) {
        finalAnswerDiv.innerHTML = `<span style="color: var(--error-color)">حدث خطأ أثناء معالجة السؤال: ${error.message}</span>`;
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

// Sidebar Drawer Functions (Mobile)
function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (sidebarOverlay) sidebarOverlay.classList.add('active');
}

function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
}

if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', openSidebar);
}
if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', closeSidebar);
}
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
}
if (headerSettingsBtn) {
    headerSettingsBtn.addEventListener('click', openModal);
}
if (headerClearBtn) {
    headerClearBtn.addEventListener('click', () => {
        clearChatBtn.click();
    });
}

// Event Listeners for Modal Settings
openSettingsBtn.addEventListener('click', () => {
    closeSidebar();
    openModal();
});
closeSettingsBtn.addEventListener('click', closeModal);

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        closeModal();
    }
});

// Toggle API Key visibility
toggleApiKeyBtn.addEventListener('click', () => {
    const icon = toggleApiKeyBtn.querySelector('i');
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        icon.className = 'fa-solid fa-eye-slash';
    } else {
        apiKeyInput.type = 'password';
        icon.className = 'fa-solid fa-eye';
    }
});

// Save Settings Button
saveBtn.addEventListener('click', () => {
    const chosenProvider = providerSelect ? providerSelect.value : selectedProvider;
    const inputKey = apiKeyInput.value.trim();
    
    if (!inputKey) {
        showToast('يرجى إدخال مفتاح الاتصال أولاً!', 'error');
        return;
    }
    
    selectedProvider = chosenProvider;
    localStorage.setItem('fasserly_provider', selectedProvider);
    
    if (selectedProvider === 'google') {
        googleApiKey = inputKey;
        localStorage.setItem('googleApiKey', googleApiKey);
        selectedGoogleModel = modelSelect.value;
        localStorage.setItem('selectedGoogleModel', selectedGoogleModel);
    } else {
        openRouterApiKey = inputKey;
        localStorage.setItem('openRouterApiKey', openRouterApiKey);
        selectedOpenRouterModel = modelSelect.value;
        localStorage.setItem('selectedOpenRouterModel', selectedOpenRouterModel);
    }
    
    if (welcomeApiAlert) {
        welcomeApiAlert.style.display = 'none';
    }
    
    closeModal();
    showToast(`تم حفظ إعدادات ${PROVIDERS[selectedProvider].name} بنجاح.`);
    
    if (!mcpClient) {
        initMCP();
    } else {
        userInput.disabled = false;
        sendBtn.disabled = false;
    }
});

// Clear Chat Log
clearChatBtn.addEventListener('click', () => {
    closeSidebar();
    if (confirm('هل تود بالتأكيد تفريغ المحادثة الحالية؟')) {
        messages = [messages[0]]; // Reset messages to initial system instruction
        
        // Remove user and ai messages, keep only welcome msg
        const welcomeMsg = chatContainer.querySelector('.welcome-msg');
        chatContainer.innerHTML = '';
        if (welcomeMsg) {
            chatContainer.appendChild(welcomeMsg);
        } else {
            location.reload();
        }
        showToast('تم تفريغ المحادثة.');
    }
});

// Quick Prompts click handler
const quickPromptCards = document.querySelectorAll('.quick-prompt-card');
quickPromptCards.forEach(card => {
    card.addEventListener('click', () => {
        closeSidebar();
        const text = card.getAttribute('data-prompt');
        if (text) {
            userInput.value = text;
            userInput.style.height = 'auto';
            userInput.style.height = (userInput.scrollHeight) + 'px';
            handleSend();
        }
    });
});

// Text input send
sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

// Auto-adjust textarea height
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Start MCP init
initMCP();

// Auto-prompt API Key modal if not exists after slight delay
if (!getActiveApiKey()) {
    setTimeout(openModal, 800);
}
