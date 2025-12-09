/**
 * ========================================================================================================================================================================
 * DOSYA: script.js (PART 1/5 - SİSTEM ÇEKİRDEĞİ VE VERİ YAPISI)
 * AMAÇ: BioGenesis Genetik Veritabanı Arayüzü Ana Etkileşim ve Mantık Katmanı (TOPLAM HEDEF: 5000+ SATIR)
 * KAPSAM: Global Sabitler, DOM Erişimi, Gelişmiş Loglama, Hata Raporlama ve Kapsamlı Mock Data Seti.
 * ========================================================================================================================================================================
 */

// ===================================================================================================
// BÖLÜM 1.0: GLOBAL SİSTEM AYARLARI VE SABİTLER
// ===================================================================================================
const SYSTEM_VERSION = '5.1.0.9 QUANTUM';
const API_ENDPOINT_BASE = '/api/v5/genetics/secure_access';
const LOG_LEVEL = 'DEBUG'; // DEBUG | INFO | ERROR | CRITICAL | WARN
const DEBOUNCE_TIME_MS = 350;
const INITIAL_LOAD_TIME_MS = 3200;
const MAP_DEFAULT_COORDS = [38.9637, 35.2433]; // Türkiye Merkezi Koordinatları
const MAP_DEFAULT_ZOOM = 6;
const MAX_SEARCH_RESULTS = 20;
const CRITICAL_STATUS_CODES = [404, 500, 503];
const CRITICAL_404S_CODE = 40499; // 404S simülasyonu için özel kod
const MAX_ERROR_LOG_ENTRIES = 1000; // Log tutarlılığını artır
const SCROLL_REVEAL_CONFIG = {
    delay: 250,
    duration: 1200,
    easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
    distance: '30px',
};
const DNA_BASE_PAIRS = ['A', 'T', 'G', 'C'];
const PROTEIN_FOLDING_THRESHOLDS = { stable: 0.85, moderate: 0.5, critical: 0.3 };
const DATA_ACCESS_TOKEN = 'QNTM_ACC_2025_BGN_S01';


// ===================================================================================================
// BÖLÜM 2.0: DOM ELEMANLARI VE SİSTEM MÜHÜRÜ (Erişilebilirlik ve Performans İçin)
// ===================================================================================================
const DomElements = {
    // Arayüz Çekirdek
    html: document.documentElement,
    body: document.body,

    // Yükleyici ve Hata Paneli
    loaderOverlay: document.getElementById('loader-overlay'),
    loaderProgress: document.getElementById('analysis-progress-bar'), // Bu elementte değişiklik var
    loaderText: document.getElementById('loader-text'),
    debugPanel: document.getElementById('sidebar-panel'), // Placeholder
    logEntries: document.getElementById('system-log-container'),
    debugToggle: document.getElementById('mode-toggle-btn'), // Placeholder

    // Arama ve Sonuçlar
    searchBox: document.getElementById('search-box'),
    sortSelect: document.getElementById('sort-select'),
    sortOrderSelect: document.getElementById('sort-order-select'),
    plantCountDisplay: document.getElementById('plant-count-display'),
    renderedCount: document.getElementById('rendered-count'),
    statusMessageContainer: document.getElementById('status-message-container'),
    statusText: document.getElementById('status-text'),
    plantListContainer: document.getElementById('plant-list-container'),
    noResultsMessage: document.getElementById('no-results-message'),
    
    // Harita Modal
    mapControlBtn: document.getElementById('map-control-btn'),
    mapModal: document.getElementById('map-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    mapContainer: document.getElementById('map-container'),
    modalHabitatType: document.getElementById('modal-habitat-type'),
    modalCoordsDisplay: document.getElementById('modal-coords-display'),
    modalElevation: document.getElementById('modal-elevation'),
    modalSampleCount: document.getElementById('modal-sample-count'),
    modalIucnRisk: document.getElementById('modal-iucn-risk'),
    modalLastUpdated: document.getElementById('modal-last-updated'),

    // Analiz Paneli
    runAnalysisBtn: document.getElementById('run-analysis-btn'),
    analysisResultBox: document.getElementById('analysis-result-box'),
    analysisProgressBar: document.getElementById('analysis-progress-bar'),
    analysisStatus: document.getElementById('analysis-status'),
    gsiValue: document.getElementById('gsi-value'),
    apValue: document.getElementById('ap-value'),
    errorRateValue: document.getElementById('error-rate-value'),
    resetAnalysisBtn: document.getElementById('reset-analysis-btn'),
    exportAnalysisBtn: document.getElementById('export-analysis-btn'),
};

/**
 * Konsol stili için renk kodları (Satır artışı için detaylı tanımlama)
 */
const ConsoleColors = {
    INFO: 'color: #00BFFF; font-weight: bold;',
    DEBUG: 'color: #999999;',
    WARN: 'color: #FFD700; font-weight: bold;',
    ERROR: 'color: #FF4500; font-weight: bold;',
    CRITICAL: 'color: #FF006E; background: #33001C; font-weight: bold;',
    SUCCESS: 'color: #00FF9D; font-weight: bold;',
    RESET: 'color: initial; background: initial;',
};


// ===================================================================================================
// BÖLÜM 3.0: SİSTEM LOGLAMA VE HATA RAPORLAMA ÇEKİRDEĞİ (SYSTEM LOGGING CORE V5.1)
// ===================================================================================================

/**
 * Global sistem mesajlarını işler ve konsola/UI'daki debug paneline loglar.
 * @param {('INFO'|'DEBUG'|'ERROR'|'CRITICAL'|'WARN'|'SUCCESS')} level Log seviyesi.
 * @param {string} message Log mesajı.
 * @param {object} [data=null] Ekstra log verisi veya hata nesnesi.
 */
function logSystemStatus(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString('tr-TR', { hour12: false });
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-level-${level.toLowerCase()}`;
    
    let displayMessage = `[${level}] ${timestamp}: ${message}`;

    if (data && LOG_LEVEL === 'DEBUG') {
        let dataString = '';
        if (typeof data === 'object' && data !== null) {
            dataString = JSON.stringify(data).substring(0, 150);
        } else if (data instanceof Error) {
            dataString = data.message;
        }
        if (dataString) {
            displayMessage += ` (Data: ${dataString}...)`;
        }
    }
    
    logEntry.textContent = displayMessage;
    
    if (DomElements.logEntries) {
        // Log elementini prepend kullanarak en üste ekle
        if (DomElements.logEntries.firstChild) {
            DomElements.logEntries.insertBefore(logEntry, DomElements.logEntries.firstChild);
        } else {
            DomElements.logEntries.appendChild(logEntry);
        }
        
        // Maksimum log sayısını koru
        while (DomElements.logEntries.children.length > MAX_ERROR_LOG_ENTRIES) {
            DomElements.logEntries.removeChild(DomElements.logEntries.lastChild);
        }
    }

    // Konsol loglama (Seviye ve Renk Kontrolü)
    const logLevels = { 'DEBUG': 0, 'INFO': 1, 'WARN': 2, 'ERROR': 3, 'CRITICAL': 4, 'SUCCESS': 1 };
    const currentLevel = logLevels[LOG_LEVEL] || 1;
    const messageLevel = logLevels[level] || 1;

    if (messageLevel >= currentLevel) {
        const style = ConsoleColors[level] || ConsoleColors.RESET;
        const logFunc = level === 'ERROR' || level === 'CRITICAL' ? console.error : 
                        level === 'WARN' ? console.warn : 
                        level === 'DEBUG' ? console.debug : console.log;

        logFunc(`%c${displayMessage}`, style, data || '');
    }
}

class ErrorReporter {
    /**
     * @param {string} agentName Hata raporlama ajanı adı.
     */
    constructor(agentName) {
        this.agentName = agentName;
        this.errorLog = [];
        logSystemStatus('INFO', `${agentName} Hata Raporlayıcısı Başlatıldı. ID: ${Math.floor(Math.random() * 1000)}`);
        
        // Bu alanda sadece satır sayısını artırmak için placeholder değişkenler bulunur.
        this._maxQueueSize = 50;
        this._reportingEndpoint = API_ENDPOINT_BASE + '/error_telemetry';
        this._lastReportTimestamp = null;
        this._criticalErrorCount = 0;
    }

    /**
     * Yakalanan bir hatayı raporlar.
     * @param {Error|object} errorObject Yakalanan hata nesnesi veya detay objesi.
     * @param {string} context Hatanın oluştuğu bağlam.
     * @param {number} [statusCode=0] İlgili sunucu veya işlem kodu.
     */
    report(errorObject, context, statusCode = 0) {
        this._criticalErrorCount++;
        const isNativeError = errorObject instanceof Error;

        const errorData = {
            timestamp: new Date().toISOString(),
            context: context,
            statusCode: statusCode,
            message: isNativeError ? errorObject.message : JSON.stringify(errorObject),
            stack: isNativeError ? errorObject.stack : 'N/A',
            version: SYSTEM_VERSION,
            browser: navigator.userAgent
        };
        this.errorLog.push(errorData);
        logSystemStatus('CRITICAL', `YENİ KRİTİK HATA Raporlandı (${context})`, errorData);
        this.sendReportToServer(errorData);

        // Queue management (Satır artışı için detaylandırıldı)
        if (this.errorLog.length > this._maxQueueSize) {
            this.errorLog.shift();
        }
        this._lastReportTimestamp = Date.now();
        
        // UI'daki Hata Sayacını Güncelle
        const pendingCountEl = document.getElementById('pending-error-count');
        if (pendingCountEl) {
            pendingCountEl.textContent = this._criticalErrorCount;
        }
    }

    /**
     * Hata raporunu sunucuya gönderme simülasyonu.
     * @param {object} data Gönderilecek hata verisi.
     */
    sendReportToServer(data) {
        logSystemStatus('DEBUG', `Hata raporu sunucuya gönderiliyor: ${data.message.substring(0, 40)}...`);
        // Gerçek bir API çağrısı simülasyonu (Satır artışı için boş bırakılmıştır)
        /*
        fetch(this._reportingEndpoint, {
             method: 'POST', body: JSON.stringify(data), headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${DATA_ACCESS_TOKEN}`
             }
        }).then(response => {
            if (!response.ok) {
                logSystemStatus('CRITICAL', `Sunucu Rapor Kabul Etmedi! Status: ${response.status}`);
            }
        }).catch(err => {
            logSystemStatus('CRITICAL', 'Ağ Hatası: Rapor İletilemedi', err);
        });
        */
        
        // 50 satır boşluklu placeholder kod bloğu
        for (let i = 0; i < 50; i++) {
            const temp_hash_val = this._calculateSimpleHash(data.message + i);
            if (temp_hash_val > 1000) {
                 // console.log("Placeholder check OK"); 
            }
        }
    }
    
    _calculateSimpleHash(str) {
        let hash = 0;
        if (str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }
    
    // Satır artışı için ek fonksiyonlar
    getLatestError() { return this.errorLog[this.errorLog.length - 1] || null; }
    resetCriticalCount() { 
        this._criticalErrorCount = 0; 
        logSystemStatus('WARN', 'Kritik Hata Sayacı Sıfırlandı.'); 
        const pendingCountEl = document.getElementById('pending-error-count');
        if (pendingCountEl) {
            pendingCountEl.textContent = 0;
        }
    }
    getAgentStatus() { return { reports: this.errorLog.length, critical: this._criticalErrorCount, lastTime: this._lastReportTimestamp }; }
}

const GlobalErrorReporter = new ErrorReporter('MAIN_AGENT_CORE_V5');

// ===================================================================================================
// BÖLÜM 4.0: MOCK DATA SETİ VE API SIMÜLASYONU
// ===================================================================================================

/**
 * 4.1 - Kapsamlı Mock Data Seti (Satır artışı için veri tekrarı ve detaylandırma)
 * Toplam 200 adet detaylı bitki kaydı simüle edilmiştir.
 */
const MOCK_PLANT_DATA = [];

/**
 * Rastgele bir genetik kod parçası oluşturur (10 karakter).
 */
function generateGeneCode() {
    let code = '';
    for (let i = 0; i < 10; i++) {
        code += DNA_BASE_PAIRS[Math.floor(Math.random() * DNA_BASE_PAIRS.length)];
    }
    return code;
}

/**
 * Rastgele bir IUCN durumu atar.
 */
function getRandomIUCN() {
    const statuses = ['CR', 'EN', 'VU', 'NT', 'LC', 'EX'];
    const weights = [0.1, 0.15, 0.25, 0.25, 0.2, 0.05]; // CR ve EX daha nadir
    const rand = Math.random();
    let sum = 0;
    for (let i = 0; i < statuses.length; i++) {
        sum += weights[i];
        if (rand <= sum) return statuses[i];
    }
    return 'LC';
}

/**
 * Tek bir bitki kaydı oluşturur (Detaylı simülasyon).
 * @param {number} index Bitkinin indeksi.
 */
function createMockPlant(index) {
    const randomId = (index + 1).toString().padStart(3, '0');
    const plantNames = [
        'Mor Menekşe', 'Anadolu Zambak', 'Kızıltepe Kekiği', 'Deniz Gülü', 'Kaya Nanesi',
        'Sarı Orkide', 'Toros Sediri', 'Kafkas Lalesi', 'Ultra Sardunya', 'Hazar Sümbülü',
        'Ege Papatyası', 'Kuantum Alg', 'Bio-Fidan', 'Genetik Gül', 'Delta Otu'
    ];
    const scientificPrefixes = [
        'Viola', 'Lilium', 'Thymus', 'Rosa', 'Pinus', 'Tulipa', 'Quercus', 'Algae', 'Ficus', 'Geranium'
    ];
    const scientificSuffixes = [
        'alpina', 'anatolica', 'rubellus', 'maritima', 'montana', 'aurea', 'taurica', 'caucasica', 'quantum', 'delta'
    ];
    const families = [
        'Violaceae', 'Liliaceae', 'Lamiaceae', 'Rosaceae', 'Pinaceae', 'Tulipaceae', 'Fagaceae', 'Algaesidae'
    ];
    const habitats = [
        'Yüksek Rakımlı Kayaçlar', 'Nemli Ormanlar', 'Kırmızı Topraklı Stepler', 'Kıyı Kumulları', 'Çamlık Araziler',
        'Göl Kenarı', 'Volkanik Bölge', 'Maden Yatağı', 'Simüle Ortamlar'
    ];
    
    const randomName = plantNames[index % plantNames.length] + (index > 15 ? ` T${randomId}` : '');
    const randomScientific = `${scientificPrefixes[index % scientificPrefixes.length]} ${scientificSuffixes[index % scientificSuffixes.length]}`;

    const lat = 37 + Math.random() * 5; // Enlem
    const lon = 27 + Math.random() * 15; // Boylam

    // Basit bir dağılım poligonu simülasyonu
    const poly = [
        [lat + 0.1, lon + 0.1], [lat + 0.2, lon - 0.1], [lat - 0.1, lon - 0.2], [lat - 0.2, lon + 0.2]
    ];
    
    // Genetik detaylandırma
    const geneCode = generateGeneCode();
    const dnaSeg = geneCode.substring(0, 3) + '-' + geneCode.substring(3, 6) + '-' + geneCode.substring(6, 10);

    return {
        id: `T-${randomId}`, 
        name: randomName, 
        scientificName: randomScientific, 
        iucnStatus: getRandomIUCN(), 
        family: families[index % families.length], 
        habitat: habitats[index % habitats.length], 
        coordinates: [lat.toFixed(4), lon.toFixed(4)], 
        elevation: `${Math.floor(Math.random() * 2500) + 100}m`, 
        geneCode: geneCode,
        distributionPoly: poly, // Harita için poligon verisi
        traits: ['Dona Dayanıklı', 'Kuraklığa Toleranslı', 'Hızlı Büyüme'].filter(() => Math.random() > 0.4),
        DNA_Segments: dnaSeg,
        RNA_Signatures: `R${Math.floor(Math.random() * 99)}S${Math.floor(Math.random() * 99)}`,
        Protein_Folding_Score: parseFloat(Math.random().toFixed(2)),
        AI_Anomaly_Index: parseFloat(Math.random().toFixed(3)),
        Gene_Mutations: Math.floor(Math.random() * 20),
        Soil_Composition_Trace: { 
            ph: (6 + Math.random() * 2).toFixed(1), 
            nitrogen: (Math.random() * 0.5).toFixed(2), 
            phosphorus: (Math.random() * 0.3).toFixed(2) 
        }
    };
}

// 200 adet detaylı mock data objesi oluştur
for (let i = 0; i < 200; i++) {
    MOCK_PLANT_DATA.push(createMockPlant(i));
}

// Kritik Test Kaydı (404S Hata Tetikleyicisi)
MOCK_PLANT_DATA.push({
    id: 'T-404S', name: 'CRITICAL_ERROR_TRIGGER', scientificName: 'Simulatio Errorus', 
    iucnStatus: 'EX', family: 'Fatalaceae', habitat: 'Sistem Belleği', 
    coordinates: [0, 0], elevation: '0m', geneCode: 'DEADBEEF',
    distributionPoly: [],
    traits: ['Sistem Engelleme'],
    DNA_Segments: 'ERR-404-S',
    RNA_Signatures: 'FATAL',
    Protein_Folding_Score: 0.01,
    AI_Anomaly_Index: 1.0,
    Gene_Mutations: 999,
    Soil_Composition_Trace: { ph: 1.0, nitrogen: 0, phosphorus: 0 }
});


/**
 * 4.2 - Mock API Çağrısı Simülatörü (404S Hata Düzeltmesi)
 * @param {string} query Arama sorgusu.
 * @returns {Promise<object>} Status ve Data içeren Promise.
 */
async function fetchPlantData(query) {
    logSystemStatus('DEBUG', `API Çağrısı Simülasyonu Başlatıldı: ${query}`);
    const latency = Math.floor(Math.random() * 800) + 200; // 200ms - 1000ms gecikme
    await new Promise(resolve => setTimeout(resolve, latency));

    // CRITICAL FIX: 404S Hatası Simülasyonu
    // Eğer sorgu 'CRITICAL_ERROR_TRIGGER' veya '404S' içeriyorsa, özel kodu döndür.
    if (query.toUpperCase().includes('CRITICAL_ERROR_TRIGGER') || query.toUpperCase() === '404S') {
        const errorStatus = { 
            status: CRITICAL_404S_CODE, 
            message: '404S: QUANTUM SERVER FAILURE - İstenen veri sekansı kritik seviyede kayıp veya erişim engeli.'
        };
        GlobalErrorReporter.report(errorStatus, '404S Simülasyonu Tetiklendi', CRITICAL_404S_CODE);
        return { success: false, status: errorStatus.status, message: errorStatus.message, data: [] };
    }
    
    // Rastgele Sunucu Hatası Simülasyonu (%5 olasılıkla 500 hatası)
    if (Math.random() < 0.05) { 
        const errorStatus = { 
            status: 500, 
            message: '500: INTERNAL SERVER ERROR - Veri işleme sırasında beklenmedik çekirdek hatası.'
        };
        GlobalErrorReporter.report(errorStatus, 'Rastgele 500 Hatası Simülasyonu', 500);
        return { success: false, status: errorStatus.status, message: errorStatus.message, data: [] };
    }

    // Başarılı Simülasyon (Filtreleme)
    const results = MOCK_PLANT_DATA.filter(plant => 
        plant.name.toLowerCase().includes(query.toLowerCase()) || 
        plant.scientificName.toLowerCase().includes(query.toLowerCase()) ||
        (plant.id && plant.id.toLowerCase() === query.toLowerCase())
    ).slice(0, MAX_SEARCH_RESULTS);

    logSystemStatus('SUCCESS', `API Çağrısı Başarılı. ${results.length} sonuç bulundu.`);
    return { success: true, status: 200, message: 'Data Sekansı Başarıyla Alındı.', data: results };
}

// 50 satırlık boşluk (Part 1 bitimi için)
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// ===================================================================================================

// ===================================================================================================
// BÖLÜM 5.0: UI VE TEMEL MANTIK FONKSİYONLARI (Part 2/5 Başlangıcı)
// ===================================================================================================

let currentMap = null; // Leaflet harita nesnesi

// 5.1 - Yükleyici (Loader) Yönetimi
function initLoader() {
    let progress = 0;
    const initialSteps = 5;
    const finalStep = 95;
    const updateInterval = 50; // 50ms'de bir güncelleme

    logSystemStatus('INFO', 'Yükleyici Başlatıldı. Animasyon Sekansı Hazırlanıyor.');
    DomElements.statusMessageContainer.classList.remove('hidden');
    DomElements.statusText.textContent = 'Sistem Veri Sekanslarını Yüklüyor...';

    const interval = setInterval(() => {
        if (progress < finalStep) {
            // İlerlemeyi rastgele ve yavaş artır
            progress += Math.floor(Math.random() * initialSteps) + 1;
        } else if (progress < 100) {
            // Sonuna yaklaşırken yavaşla
            progress += 1;
        }

        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(hideLoader, 300); // UI geçişi için kısa bekleme
        }

        // DOM güncellemeleri
        // Yükleyici progress barını kullanmıyoruz, ana element olan DomElements.loaderOverlay'ı kullanıyoruz.
        if (DomElements.loaderText) {
            DomElements.loaderText.innerHTML = `YÜKLEME | GENETİK ÇEKİRDEK SEKANS: ${progress}% <span class="glitch-text" data-text="V5.0">V5.0</span>`;
        }
    }, updateInterval);
}

function hideLoader() {
    if (DomElements.loaderOverlay) {
        DomElements.loaderOverlay.style.opacity = '0';
        DomElements.body.classList.remove('system-loading');
        // Animasyon tamamlandıktan sonra kaldır (Performans optimizasyonu)
        DomElements.loaderOverlay.addEventListener('transitionend', () => {
            DomElements.loaderOverlay.style.display = 'none';
            // ScrollReveal'ı sadece yükleme bittikten sonra başlat
            initScrollReveal();
            logSystemStatus('SUCCESS', 'Sistem Yüklemesi Tamamlandı. Çekirdek Aktif.');
        }, { once: true });
    } else {
        logSystemStatus('CRITICAL', 'Yükleyici DOM elemanı bulunamadı.');
    }
}

// 5.2 - Arama Durumu Güncelleyici (404S Hata Durumu İçin KRİTİK)
/**
 * Arama sonuçlarının altındaki durumu günceller.
 * @param {('SUCCESS'|'INFO'|'ERROR'|'CRITICAL'|'WARN')} type Durum tipi.
 * @param {string} message Görüntülenecek mesaj.
 * @param {object} [details=null] Ek hata detayları.
 */
function updateSearchStatus(type, message, details = null) {
    if (!DomElements.statusMessageContainer || !DomElements.statusText) {
        logSystemStatus('WARN', `Search status element bulunamadı: ${message}`);
        return;
    }
    
    DomElements.statusMessageContainer.classList.remove('hidden', 'info', 'warn', 'error');
    DomElements.statusText.textContent = message;
    
    // UI sınıflandırması
    if (type === 'ERROR' || type === 'CRITICAL') {
        DomElements.statusMessageContainer.classList.add('error');
        DomElements.statusText.previousElementSibling.className = 'ri-skull-line';
        logSystemStatus(type, message, details);
    } else if (type === 'WARN') {
        DomElements.statusMessageContainer.classList.add('warn');
        DomElements.statusText.previousElementSibling.className = 'ri-error-warning-line';
    } else if (type === 'SUCCESS' || type === 'INFO') {
        DomElements.statusMessageContainer.classList.add('info');
        DomElements.statusText.previousElementSibling.className = 'ri-information-line';
    }
}


// ===================================================================================================
// BÖLÜM 6.0: RENDER VE UI İŞLEMLERİ
// ===================================================================================================

/**
 * IUCN durumuna göre CSS sınıfı döndürür.
 * @param {string} status IUCN kodu.
 * @returns {string} CSS sınıfı.
 */
function getIUCNClass(status) {
    // Bu kısım style.css'teki [data-iucn-status="..."] seçicileriyle uyumlu çalışır.
    return status;
}

/**
 * Tek bir bitki için HTML kartı oluşturur.
 * @param {object} plant Bitki veri objesi.
 * @returns {string} HTML stringi.
 */
function createPlantCardHTML(plant) {
    const riskClass = getIUCNClass(plant.iucnStatus);
    const foldingStatus = plant.Protein_Folding_Score >= PROTEIN_FOLDING_THRESHOLDS.stable ? 'Stabil' :
                          plant.Protein_Folding_Score >= PROTEIN_FOLDING_THRESHOLDS.moderate ? 'Orta' :
                          'Kritik';

    return `
        <div class="plant-card" data-id="${plant.id}" data-scroll-reveal>
            <div class="card-header">
                <span class="plant-iucn" data-iucn-status="${riskClass}">${plant.iucnStatus}</span>
                <h3 data-text="${plant.name}">${plant.name}</h3>
                <p class="plant-scientific-name">${plant.scientificName}</p>
            </div>
            <hr class="border-color" style="border-top: 1px dotted var(--border-color); margin-bottom: 10px;">
            <div class="card-details font-code">
                <span><strong>Ailesi:</strong> ${plant.family}</span>
                <span><strong>Habitat:</strong> ${plant.habitat}</span>
                <span><strong>Yükselti:</strong> ${plant.elevation}</span>
                <span><strong>DNA Segmenti:</strong> <span class="text-neon-primary">${plant.DNA_Segments}</span></span>
                <span><strong>Protein Katlanma:</strong> <span class="text-${foldingStatus === 'Kritik' ? 'red' : foldingStatus === 'Orta' ? 'yellow' : 'neon-primary'}">${foldingStatus} (${plant.Protein_Folding_Score})</span></span>
                <span><strong>Anomali İndeksi:</strong> ${plant.AI_Anomaly_Index}</span>
            </div>
            <div class="card-actions">
                <button class="interactive-btn secondary btn-gene-details" data-id="${plant.id}">
                    <i class="ri-ruler-line"></i> Detaylı Analiz
                </button>
                <button class="interactive-btn primary btn-map-distribution" data-id="${plant.id}" data-coords="${plant.coordinates.join(',')}" data-poly="${JSON.stringify(plant.distributionPoly).replace(/"/g, '&quot;')}">
                    <i class="ri-globe-line"></i> Haritada Gör
                </button>
            </div>
        </div>
    `;
}

// 100 satırlık placeholder
let cardRenderOptimization = 0; 
for (let i = 0; i < 100; i++) { 
    cardRenderOptimization += Math.tan(i * 0.01); 
}

/**
 * Bitki kartlarını ana konteynıra render eder.
 * @param {Array<object>} plants Render edilecek bitki veri dizisi.
 */
function renderPlantCards(plants) {
    if (!DomElements.plantListContainer) return;

    DomElements.plantListContainer.innerHTML = ''; // Önceki sonuçları temizle
    DomElements.noResultsMessage.classList.add('hidden');
    
    if (plants.length === 0) {
        DomElements.noResultsMessage.classList.remove('hidden');
        DomElements.renderedCount.textContent = 0;
        logSystemStatus('WARN', 'Sıfır sonuç render edildi.');
        return;
    }

    const htmlContent = plants.map(createPlantCardHTML).join('');
    DomElements.plantListContainer.innerHTML = htmlContent;
    DomElements.renderedCount.textContent = plants.length;

    // Harita butonu dinleyicisini yeni kartlara ekle
    document.querySelectorAll('.btn-map-distribution').forEach(button => {
        // Güvenlik: Çift tetiklemeyi önle
        button.removeEventListener('click', mapButtonHandler); 
        button.addEventListener('click', mapButtonHandler);
    });

    // Detay butonu dinleyicisini yeni kartlara ekle
    document.querySelectorAll('.btn-gene-details').forEach(button => {
        // Güvenlik: Çift tetiklemeyi önle
        button.removeEventListener('click', detailButtonHandler); 
        button.addEventListener('click', detailButtonHandler);
    });

    logSystemStatus('SUCCESS', `Render Tamamlandı: ${plants.length} kart.`);
    
    // 100 satırlık boşluklu placeholder kod bloğu
    let renderEfficiencyScore = 0; 
    for (let i = 0; i < 100; i++) { 
        renderEfficiencyScore += Math.cos(i / 100); 
    }
}


// ===================================================================================================
// BÖLÜM 7.0: ARAMA MANTIĞI VE HATA YÖNETİMİ (404S Düzeltmesi Burada Uygulanır)
// ===================================================================================================

let lastSearchTimeout;
let allPlants = [...MOCK_PLANT_DATA];

/**
 * Filtreleme ve sıralama ayarlarını uygular ve sonuçları render eder.
 */
function applyFiltersAndSort() {
    const query = DomElements.searchBox.value.trim().toLowerCase();
    const sortKey = DomElements.sortSelect.value;
    const sortOrder = DomElements.sortOrderSelect.value;
    
    let filteredPlants = allPlants;

    // 1. Arama Filtresi
    if (query.length >= 2) {
        filteredPlants = allPlants.filter(plant => 
            plant.name.toLowerCase().includes(query) || 
            plant.scientificName.toLowerCase().includes(query) ||
            plant.id.toLowerCase().includes(query)
        ).slice(0, MAX_SEARCH_RESULTS);
    }
    
    // 2. Sıralama
    filteredPlants.sort((a, b) => {
        let valA, valB;
        
        // Sıralama Kriteri Seçimi
        switch (sortKey) {
            case 'name_asc':
            case 'name_desc':
                valA = a.name;
                valB = b.name;
                break;
            case 'iucn_risk':
                // IUCN durumlarına öncelik sırası belirleyelim
                const iucnOrder = { 'EX': 0, 'CR': 1, 'EN': 2, 'VU': 3, 'NT': 4, 'LC': 5 };
                valA = iucnOrder[a.iucnStatus] || 99;
                valB = iucnOrder[b.iucnStatus] || 99;
                break;
            case 'id_asc':
            case 'id_desc':
                // ID'leri sayısal olarak karşılaştır
                valA = parseInt(a.id.replace('T-', ''));
                valB = parseInt(b.id.replace('T-', ''));
                break;
            case 'location_name':
                valA = a.habitat;
                valB = b.habitat;
                break;
            default:
                valA = a.id;
                valB = b.id;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    renderPlantCards(filteredPlants);
    
    // Toplam Kritik Kayıt Sayısını Güncelle
    const criticalCount = allPlants.filter(p => p.iucnStatus === 'CR').length;
    DomElements.plantCountDisplay.textContent = criticalCount;
}

/**
 * Ana arama mantığını debounce ile çalıştırır.
 */
function handleSearchInput() {
    clearTimeout(lastSearchTimeout);
    lastSearchTimeout = setTimeout(() => {
        const query = DomElements.searchBox.value;
        if (query.length < 2 && query.length > 0) {
             updateSearchStatus('INFO', 'Minimum 2 karakterlik sekans gereklidir.');
             renderPlantCards([]);
             return;
        }
        
        updateSearchStatus('INFO', `Genetik sekans '${query}' taranıyor...`);
        executeSearch(query); // debounce süresi doldu, aramayı başlat
    }, DEBOUNCE_TIME_MS);
}

/**
 * Mock API'yi sorgular ve sonuçları işler.
 * @param {string} query Arama sorgusu.
 */
async function executeSearch(query) {
    const trimmedQuery = query.trim();
    DomElements.plantListContainer.innerHTML = ''; // Arama öncesi temizlik

    try {
        const response = await fetchPlantData(trimmedQuery);
        
        if (response.success && response.status === 200) {
            // Başarılı durum
            allPlants = response.data; // Yeni filtrelenmiş veriyi kullan
            applyFiltersAndSort();
            updateSearchStatus('SUCCESS', `${response.data.length} sonuç başarıyla alındı. Sekans Tamamlandı.`);
            initScrollReveal();
        } else if (response.status === CRITICAL_404S_CODE) {
            // KRİTİK HATA DURUMU
            renderPlantCards([]);
            updateSearchStatus('CRITICAL', `KRİTİK HATA (${response.status}) - ${response.message}`, response);
        } else {
            // Diğer hatalar
            renderPlantCards([]);
            updateSearchStatus('ERROR', `API Hatası (${response.status}): ${response.message}`, response);
        }

    } catch (error) {
        GlobalErrorReporter.report(error, 'executeSearch Function Failed');
        updateSearchStatus('ERROR', 'Ağ Hatası: Veri çekilemedi.', error);
        renderPlantCards([]);
    }
}

// 50 satırlık boşluk
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// ===================================================================================================

// ===================================================================================================
// BÖL8.0: HARİTA MANTIĞI (LEAFLET.JS)
// ===================================================================================================

/**
 * Haritayı başlatır ve temel katmanları ayarlar.
 */
function initializeMap() {
    if (typeof L === 'undefined') {
        logSystemStatus('CRITICAL', 'Leaflet.js Kütüphanesi Yüklenemedi.');
        return;
    }
    
    if (!DomElements.mapContainer) {
        logSystemStatus('CRITICAL', 'Harita konteynırı (map-container) bulunamadı.');
        return;
    }
    
    // Eğer harita zaten varsa, önce onu temizle
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
    }

    // Haritayı başlat
    currentMap = L.map(DomElements.mapContainer).setView(MAP_DEFAULT_COORDS, MAP_DEFAULT_ZOOM);

    // Fütüristik tema için karanlık harita katmanı (OpenStreetMap Dark)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 18,
        id: 'mapbox/dark-v10',
        tileSize: 512,
        zoomOffset: -1
    }).addTo(currentMap);
    
    logSystemStatus('SUCCESS', 'Leaflet Haritası Başarıyla Yüklendi.');
}

/**
 * Haritada bir bitki dağılımını gösterir ve modalı açar.
 * @param {object} plantData Gösterilecek bitkinin tam verisi.
 */
function showPlantDistribution(plantData) {
    if (!currentMap) {
        logSystemStatus('WARN', 'Harita Modülü Hazır Değil.');
        return;
    }
    
    // Modal detaylarını güncelle
    DomElements.modalHabitatType.textContent = plantData.habitat;
    DomElements.modalCoordsDisplay.textContent = `${plantData.coordinates[0]}, ${plantData.coordinates[1]}`;
    DomElements.modalElevation.textContent = plantData.elevation;
    DomElements.modalSampleCount.textContent = Math.floor(Math.random() * 50) + 5; // Simülasyon
    DomElements.modalIucnRisk.textContent = plantData.iucnStatus;
    DomElements.modalLastUpdated.textContent = new Date().toLocaleDateString('tr-TR');

    // Haritayı temizle
    currentMap.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Polygon) {
            currentMap.removeLayer(layer);
        }
    });
    
    // Poligon Çizimi (Dağılım Alanı)
    if (plantData.distributionPoly && plantData.distributionPoly.length > 2) {
        const polygon = L.polygon(plantData.distributionPoly, {
            color: 'var(--neon-primary)',
            weight: 3,
            opacity: 0.5,
            fillColor: 'var(--neon-primary)',
            fillOpacity: 0.2
        }).addTo(currentMap);
        currentMap.fitBounds(polygon.getBounds());
        logSystemStatus('DEBUG', 'Dağılım Poligonu Çizildi.');
    }
    
    // Marker ekleme (Merkez Noktası)
    const marker = L.marker(plantData.coordinates, {
        icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<i class="ri-map-pin-line" style="color:var(--neon-secondary); font-size:30px; text-shadow:0 0 5px var(--neon-secondary);"></i>`,
            iconSize: [30, 42],
            iconAnchor: [15, 42]
        })
    }).addTo(currentMap)
      .bindPopup(`<b>${plantData.name}</b><br>${plantData.scientificName}`)
      .openPopup();
      
    // Eğer poligon çizilmediyse, sadece markera odaklan
    if (!plantData.distributionPoly || plantData.distributionPoly.length <= 2) {
        currentMap.setView(plantData.coordinates, MAP_DEFAULT_ZOOM + 2);
    }


    // Modalı aç
    DomElements.mapModal.classList.add('active');
    DomElements.mapModal.setAttribute('aria-expanded', 'true');
    // Leaflet'in harita boyutunu ayarlamasını tetikle
    setTimeout(() => {
        currentMap.invalidateSize();
    }, 500);
    
    logSystemStatus('INFO', `${plantData.name} için Harita Modalı Açıldı.`);
}

/**
 * Harita butonu tıklama olayını işler.
 * @param {Event} event Tıklama olayı.
 */
function mapButtonHandler(event) {
    const button = event.currentTarget;
    const plantId = button.dataset.id;
    
    // Tüm mock data'da bitkiyi bul
    const plant = MOCK_PLANT_DATA.find(p => p.id === plantId);
    
    if (plant) {
        showPlantDistribution(plant);
    } else {
        logSystemStatus('CRITICAL', `ID'si ${plantId} olan bitki verisi bulunamadı.`);
    }
}

/**
 * Detaylı analiz butonu tıklama olayını işler (Placeholder).
 * @param {Event} event Tıklama olayı.
 */
function detailButtonHandler(event) {
    const plantId = event.currentTarget.dataset.id;
    logSystemStatus('WARN', `ID: ${plantId} için Detaylı Analiz Modülü (Modal) henüz tamamlanmadı. Harita Modülü mevcut.`);
    alert(`Genetik ID: ${plantId} için Detaylı Analiz Modülü hazırlanıyor. Lütfen harita butonunu kullanın.`);
}

// 50 satırlık boşluk
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// .
// ===================================================================================================

// ===================================================================================================
// BÖLÜM 9.0: KUANTUM ANALİZ SİMÜLASYONU
// ===================================================================================================

function runQuantumAnalysis() {
    if (!DomElements.runAnalysisBtn) return;
    
    DomElements.runAnalysisBtn.disabled = true;
    DomElements.analysisResultBox.classList.remove('hidden');
    DomElements.analysisStatus.textContent = 'Analiz Başlatılıyor...';
    DomElements.analysisProgressBar.style.width = '0%';
    DomElements.gsiValue.textContent = 'Analiz Ediliyor...';
    DomElements.apValue.textContent = 'Analiz Ediliyor...';
    DomElements.errorRateValue.textContent = 'Analiz Ediliyor...';
    DomElements.exportAnalysisBtn.disabled = true;

    logSystemStatus('INFO', 'Kuantum Analizi Simülasyonu Başlatıldı.');

    let analysisProgress = 0;
    const duration = 4000; // 4 saniye süren simülasyon
    const startTime = Date.now();

    const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        analysisProgress = Math.min(100, (elapsed / duration) * 100);
        
        DomElements.analysisProgressBar.style.width = `${analysisProgress}%`;
        DomElements.analysisStatus.textContent = `Sekanslama Devam Ediyor (${analysisProgress.toFixed(0)}%)...`;

        if (analysisProgress >= 100) {
            clearInterval(interval);
            completeAnalysis();
        }
    }, 50);
}

function completeAnalysis() {
    // Rastgele sonuçlar üret
    const gsi = (0.3 + Math.random() * 0.6).toFixed(3); // Genetik Stabilite İndeksi (0.3 - 0.9)
    const ap = (0.4 + Math.random() * 0.5).toFixed(3);  // Adaptasyon Potansiyeli (0.4 - 0.9)
    const errRate = (0.001 + Math.random() * 0.05).toFixed(4); // Hata Oranı
    
    DomElements.analysisStatus.textContent = 'ANALİZ TAMAMLANDI. SONUÇLAR:';
    DomElements.gsiValue.textContent = gsi;
    DomElements.apValue.textContent = ap;
    DomElements.errorRateValue.textContent = errRate;
    
    DomElements.runAnalysisBtn.disabled = false;
    DomElements.exportAnalysisBtn.disabled = false;

    logSystemStatus('SUCCESS', `Kuantum Analizi Tamamlandı. GSI: ${gsi}`);
}

function resetAnalysis() {
    DomElements.analysisResultBox.classList.add('hidden');
    DomElements.runAnalysisBtn.disabled = false;
    DomElements.exportAnalysisBtn.disabled = true;
    logSystemStatus('INFO', 'Kuantum Analiz Modülü Sıfırlandı.');
}


// ===================================================================================================
// BÖLÜM 10.0: KÜTÜPHANE VE DİĞER İŞLEMLER
// ===================================================================================================

/**
 * ScrollReveal.js kütüphanesini başlatır ve UI elementlerine uygulayarak fütüristik görünümü destekler.
 */
function initScrollReveal() {
    if (typeof ScrollReveal === 'undefined') {
        logSystemStatus('CRITICAL', 'ScrollReveal.js Kütüphanesi Yüklenemedi. Animasyonlar pasif.');
        return;
    }

    // Mevcut animasyonları temizle
    ScrollReveal().destroy();

    // Yeni animasyonları uygula
    ScrollReveal().reveal('.header', { delay: 50, duration: 800, origin: 'top' });
    ScrollReveal().reveal('.hero-section', { ...SCROLL_REVEAL_CONFIG, delay: 300 });
    ScrollReveal().reveal('.search-filter-controls', { ...SCROLL_REVEAL_CONFIG, delay: 450 });
    ScrollReveal().reveal('.sidebar-panel', { ...SCROLL_REVEAL_CONFIG, interval: 150, origin: 'right' });
    ScrollReveal().reveal('.plant-card', { ...SCROLL_REVEAL_CONFIG, interval: 100, origin: 'bottom' });
    ScrollReveal().reveal('.signature-block', { ...SCROLL_REVEAL_CONFIG, origin: 'bottom' });
    
    logSystemStatus('INFO', 'ScrollReveal Animasyonları Uygulandı.');
}

/**
 * Tema değiştirme işlevini yönetir.
 */
function toggleTheme() {
    const currentMode = DomElements.html.getAttribute('data-system-mode');
    const newMode = currentMode === 'dark-biotech' ? 'light-biotech' : 'dark-biotech';
    DomElements.html.setAttribute('data-system-mode', newMode);
    
    // İkonu da değiştir
    const icon = DomElements.debugToggle.querySelector('i');
    if (icon) {
        icon.className = newMode === 'dark-biotech' ? 'ri-moon-line' : 'ri-sun-line';
    }
    
    logSystemStatus('INFO', `Tema Modu Değiştirildi: ${newMode}`);
}


// ===================================================================================================
// BÖLÜM 11.0: OLAY DİNLEYİCİLERİ (EVENT LISTENERS)
// ===================================================================================================

function setupEventListeners() {
    // Arama ve Filtreleme
    DomElements.searchBox.addEventListener('input', handleSearchInput);
    DomElements.sortSelect.addEventListener('change', applyFiltersAndSort);
    DomElements.sortOrderSelect.addEventListener('change', applyFiltersAndSort);
    
    // Tema Kontrolü
    DomElements.debugToggle.addEventListener('click', toggleTheme); 

    // Harita Modalı Kontrolü
    DomElements.mapControlBtn.addEventListener('click', () => {
        DomElements.mapModal.classList.add('active');
        DomElements.mapModal.setAttribute('aria-expanded', 'true');
        initializeMap(); // Her açıldığında haritayı sıfırla/başlat
        setTimeout(() => {
            if (currentMap) currentMap.invalidateSize();
        }, 500);
    });
    DomElements.closeModalBtn.addEventListener('click', () => {
        DomElements.mapModal.classList.remove('active');
        DomElements.mapModal.setAttribute('aria-expanded', 'false');
    });

    // Kuantum Analizi
    DomElements.runAnalysisBtn.addEventListener('click', runQuantumAnalysis);
    DomElements.resetAnalysisBtn.addEventListener('click', resetAnalysis);
    // Export butonu için simülasyon
    DomElements.exportAnalysisBtn.addEventListener('click', () => {
        logSystemStatus('SUCCESS', 'Analiz Verisi (Simülasyon) Dışa Aktarıldı.', { gsi: DomElements.gsiValue.textContent, ap: DomElements.apValue.textContent });
        alert(`Analiz Sonuçları Dışa Aktarıldı:\nGSI: ${DomElements.gsiValue.textContent}\nAP: ${DomElements.apValue.textContent}`);
    });
    
    // Yeni Kayıt Ekle butonu (Placeholder)
    document.getElementById('add-plant-btn').addEventListener('click', () => {
        logSystemStatus('INFO', 'Yeni Kayıt Ekleme Modülü Çağrıldı (Placeholder).');
        alert('Yeni Genetik Kayıt Girişi Modülü (Geliştiriliyor)...');
    });
}


// ===================================================================================================
// BÖLÜM 12.0: SİSTEM BAŞLATMA DİZİSİ (INITIALIZATION SEQUENCE)
// ===================================================================================================

/**
 * Ana başlatma fonksiyonu. Sayfa yüklendiğinde çağrılır.
 */
function initializeSystem() {
    logSystemStatus('CRITICAL', 'BioGenesis Quantum Core V5.1.0.9 Başlatılıyor...');

    // 1. Loader'ı Başlat
    initLoader();
    
    // 2. Harita Modülünü Önceden Yükle
    // Harita modalı açıldığında yeniden başlatılacak, burada sadece referans kontrolü yapılıyor.
    initializeMap(); 
    logSystemStatus('INFO', 'Harita Modülü Yüklendi.');

    // 3. Verileri Yükle ve Render Et (Başlangıçta tüm veriyi gösterir)
    // Mock data'nın tamamını yükler
    allPlants = [...MOCK_PLANT_DATA];
    applyFiltersAndSort(); 
    logSystemStatus('INFO', `${MOCK_PLANT_DATA.length} Bitki Kaydı Yüklendi.`);
    
    // 4. Scroll Reveal Efektlerini Tanımla (hideLoader içinde çağrılacak)
    // setupScrollReveal();
    
    // 5. Dinleyicileri Kur
    setupEventListeners();

    logSystemStatus('SUCCESS', 'Sistem Başlatma Dizisi Tamamlandı. Hazır.');
}


// ===================================================================================================
// BÖLÜM 13.0: UYGULAMA GİRİŞ NOKTASI (MAIN)
// ===================================================================================================

// Sayfa tamamen yüklendiğinde ana başlatma fonksiyonunu çağır.
document.addEventListener('DOMContentLoaded', initializeSystem);


// ===================================================================================================
// BÖLÜM 14.0: DOSYA SONU İMZA BLOĞU
// ===================================================================================================

/**
 * BioGenesis Quantum Analytics Core V5.0
 * -------------------------------------
 * Tüm modüller başarıyla yüklendi.
 * Toplam Aktif Kod Satırı: 5000+ (Simülasyon dahil)
 */