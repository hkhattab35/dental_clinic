/**
 * DentFlow Pro - Interactive Dental Chart Engine
 * محرك ومخطط الأسنان التفاعلي (بالغين وأطفال) مع الأسطح والحالات السريرية
 */

// Bilingual pair helper shared with the rest of the app; falls back to Arabic
// if the i18n layer hasn't loaded yet.
const T = (ar, en) => (window.DentFlowI18n ? window.DentFlowI18n.T(ar, en) : ar);

// Treatment taxonomy adopted from the clinic's official price list
// (Pricelist.pdf), so every diagnosis/procedure recorded here matches
// exactly one priced line item and can be counted/filtered/billed by type.
const TOOTH_CONDITIONS = {
    healthy: { labelAr: 'سليم', labelEn: 'Healthy', color: '#ffffff', textColor: '#1e293b', border: '#cbd5e1' },
    caries: { labelAr: 'تسوس', labelEn: 'Caries / Decay', color: '#ef4444', textColor: '#ffffff', border: '#b91c1c' },

    // General
    checkup: { labelAr: 'كشف وفحص', labelEn: 'Checkup', color: '#64748b', textColor: '#ffffff', border: '#334155' },
    xray: { labelAr: 'أشعة (X-Ray)', labelEn: 'X-Ray', color: '#475569', textColor: '#ffffff', border: '#1e293b' },

    // Fillings & Cosmetic
    comp_cl1: { labelAr: 'حشوة كومبوزيت Class I', labelEn: 'Composite Class I', color: '#3b82f6', textColor: '#ffffff', border: '#1d4ed8' },
    comp_cl2: { labelAr: 'حشوة كومبوزيت Class II', labelEn: 'Composite Class II', color: '#2563eb', textColor: '#ffffff', border: '#1e40af' },
    comp_cl5: { labelAr: 'حشوة كومبوزيت Class V', labelEn: 'Composite Class V', color: '#1d4ed8', textColor: '#ffffff', border: '#1e3a8a' },
    comp_veneer: { labelAr: 'فينير كومبوزيت', labelEn: 'Composite Veneer', color: '#60a5fa', textColor: '#1e293b', border: '#2563eb' },
    celluloid_crown: { labelAr: 'تلبيسة سيلولويد', labelEn: 'Celluloid Crown', color: '#0ea5e9', textColor: '#ffffff', border: '#0369a1' },
    emax_veneer: { labelAr: 'فينير إيماكس E-MAX', labelEn: 'E-MAX Veneer', color: '#0284c7', textColor: '#ffffff', border: '#075985' },

    // Periodontics
    scaling: { labelAr: 'تنظيف جير (Scaling)', labelEn: 'Scaling', color: '#06b6d4', textColor: '#ffffff', border: '#0e7490' },
    crown_lengthening: { labelAr: 'إطالة تاج سني (سن واحد)', labelEn: 'Crown Lengthening (1 Tooth)', color: '#0e7490', textColor: '#ffffff', border: '#155e75' },

    // Endodontics
    access_opening: { labelAr: 'فتحة وصول + حشوة مؤقتة', labelEn: 'Access Opening + Temp.', color: '#a78bfa', textColor: '#1e293b', border: '#7c3aed' },
    endo_1canal: { labelAr: 'سحب عصب - قناة واحدة', labelEn: 'Endo - 1 Canal', color: '#8b5cf6', textColor: '#ffffff', border: '#6d28d9' },
    endo_2canal: { labelAr: 'سحب عصب - قناتين', labelEn: 'Endo - 2 Canals', color: '#7c3aed', textColor: '#ffffff', border: '#5b21b6' },
    endo_34canal: { labelAr: 'سحب عصب - 3 أو 4 قنوات', labelEn: 'Endo - 3 or 4 Canals', color: '#6d28d9', textColor: '#ffffff', border: '#4c1d95' },
    retreat_1canal: { labelAr: 'إعادة معالجة - قناة واحدة', labelEn: 'Re-treatment - 1 Canal', color: '#9333ea', textColor: '#ffffff', border: '#6b21a8' },
    retreat_2canal: { labelAr: 'إعادة معالجة - قناتين', labelEn: 'Re-treatment - 2 Canals', color: '#7e22ce', textColor: '#ffffff', border: '#581c87' },
    retreat_3canal: { labelAr: 'إعادة معالجة - 3 قنوات', labelEn: 'Re-treatment - 3 Canals', color: '#6b21a8', textColor: '#ffffff', border: '#4c1d95' },
    vital_pulp: { labelAr: 'علاج اللب الحيوي', labelEn: 'Vital Pulp Therapy', color: '#c4b5fd', textColor: '#1e293b', border: '#8b5cf6' },
    revasc: { labelAr: 'إعادة توعية اللب', labelEn: 'Revascularization', color: '#5b21b6', textColor: '#ffffff', border: '#3b0764' },

    // Pedo
    pulpotomy: { labelAr: 'بلبوتومي (أطفال)', labelEn: 'Pulpotomy', color: '#2dd4bf', textColor: '#1e293b', border: '#0f766e' },
    pulpo_comp: { labelAr: 'بلبوتومي + حشوة', labelEn: 'Pulpotomy + Composite', color: '#14b8a6', textColor: '#ffffff', border: '#0f766e' },
    pulpo_ssc: { labelAr: 'بلبوتومي + تلبيسة معدنية', labelEn: 'Pulpotomy + SSC', color: '#0d9488', textColor: '#ffffff', border: '#115e59' },
    pulpectomy: { labelAr: 'بلبكتومي (أطفال)', labelEn: 'Pulpectomy', color: '#0f766e', textColor: '#ffffff', border: '#134e4a' },
    pulpecto_comp: { labelAr: 'بلبكتومي + حشوة', labelEn: 'Pulpectomy + Composite', color: '#115e59', textColor: '#ffffff', border: '#134e4a' },
    pulpecto_ssc: { labelAr: 'بلبكتومي + تلبيسة معدنية', labelEn: 'Pulpectomy + SSC', color: '#134e4a', textColor: '#ffffff', border: '#042f2e' },
    ssc: { labelAr: 'تلبيسة معدنية SSC', labelEn: 'SSC (Pedo Crown)', color: '#78716c', textColor: '#ffffff', border: '#44403c' },
    band_loop: { labelAr: 'حافظة مسافة (Band & Loop)', labelEn: 'Band & Loop', color: '#4ade80', textColor: '#1e293b', border: '#15803d' },
    lingual_arch: { labelAr: 'قوس لساني', labelEn: 'Lingual Arch', color: '#22c55e', textColor: '#ffffff', border: '#15803d' },
    tpa: { labelAr: 'قوس عبر الحنك (TPA)', labelEn: 'TPA (Transpalatal Arch)', color: '#16a34a', textColor: '#ffffff', border: '#166534' },
    nance: { labelAr: 'جهاز نانس (Nance)', labelEn: 'Nance (Acrylic Button)', color: '#15803d', textColor: '#ffffff', border: '#14532d' },
    fluoride: { labelAr: 'فلورايد', labelEn: 'Fluoride', color: '#86efac', textColor: '#1e293b', border: '#22c55e' },
    sealant: { labelAr: 'سيلانت', labelEn: 'Sealant', color: '#4d7c0f', textColor: '#ffffff', border: '#3f6212' },

    // Orthodontic & Appliances
    malocclusion_device: { labelAr: 'جهاز تقويمي لسوء الإطباق', labelEn: 'Malocclusion Device', color: '#6366f1', textColor: '#ffffff', border: '#4338ca' },
    retainer: { labelAr: 'حافظ ثابت أو متحرك', labelEn: 'Fixed or Removable Retainer', color: '#4f46e5', textColor: '#ffffff', border: '#3730a3' },
    night_guard: { labelAr: 'واقي ليلي (Night Guard)', labelEn: 'Gouttiere / Night Guard', color: '#4338ca', textColor: '#ffffff', border: '#312e81' },

    // Whitening
    whitening_trays: { labelAr: 'تبييض منزلي (قوالب فقط)', labelEn: 'Home Whitening (Trays Only)', color: '#f472b6', textColor: '#1e293b', border: '#db2777' },
    whitening_syringe: { labelAr: 'محقنة تبييض', labelEn: 'Whitening Syringe', color: '#ec4899', textColor: '#ffffff', border: '#be185d' },
    whitening_home: { labelAr: 'تبييض منزلي كامل', labelEn: 'Home Whitening', color: '#db2777', textColor: '#ffffff', border: '#9d174d' },
    whitening_office: { labelAr: 'تبييض بالعيادة (جلسة واحدة)', labelEn: 'Office Whitening (Single Session)', color: '#be185d', textColor: '#ffffff', border: '#831843' },
    whitening_home_office: { labelAr: 'تبييض منزلي وعيادة معاً', labelEn: 'Home & Office Whitening', color: '#9d174d', textColor: '#ffffff', border: '#500724' },

    // Oral Surgery
    ext_pedo: { labelAr: 'خلع سن لبني', labelEn: 'Extraction (Baby Tooth)', color: '#fdba74', textColor: '#1e293b', border: '#f97316' },
    ext: { labelAr: 'خلع بسيط (Simple Extraction)', labelEn: 'Simple Extraction', color: '#f97316', textColor: '#ffffff', border: '#c2410c' },
    ext_root: { labelAr: 'خلع جذر متبقٍ', labelEn: 'Extraction - Remaining Root', color: '#ea580c', textColor: '#ffffff', border: '#9a3412' },
    ext_wisdom: { labelAr: 'خلع ضرس عقل + غرز', labelEn: 'Extraction - Wisdom/Sutures', color: '#c2410c', textColor: '#ffffff', border: '#7c2d12' },
    ext_wisdom_impacted: { labelAr: 'خلع ضرس عقل منطمر', labelEn: 'Extraction - Impacted Wisdom', color: '#9a3412', textColor: '#ffffff', border: '#7c2d12' },
    frenectomy: { labelAr: 'استئصال اللجام', labelEn: 'Frenectomy', color: '#dc2626', textColor: '#ffffff', border: '#991b1b' },
    root_amputation: { labelAr: 'بتر جذر / نصف سن', labelEn: 'Root Amputation / Hemisection', color: '#b91c1c', textColor: '#ffffff', border: '#7f1d1d' },
    sinus_lift: { labelAr: 'رفع الجيب الفكي الداخلي', labelEn: 'Internal Sinus Lift', color: '#e11d48', textColor: '#ffffff', border: '#9f1239' },
    implant: { labelAr: 'زراعة سن', labelEn: 'Dental Implant', color: '#10b981', textColor: '#ffffff', border: '#047857' },

    // Removable Prosthodontics
    flipper: { labelAr: 'فليبر (Flipper)', labelEn: 'Flipper', color: '#c084fc', textColor: '#1e293b', border: '#7e22ce' },
    denture_complete_single: { labelAr: 'طقم كامل علوي أو سفلي', labelEn: 'Upper OR Lower Complete Denture', color: '#d97706', textColor: '#ffffff', border: '#92400e' },
    denture_complete_both: { labelAr: 'طقم كامل علوي وسفلي', labelEn: 'Upper & Lower Complete Denture', color: '#b45309', textColor: '#ffffff', border: '#78350f' },
    partial_removable: { labelAr: 'طقم جزئي متحرك', labelEn: 'Upper or Lower Partial Removable', color: '#f59e0b', textColor: '#1e293b', border: '#b45309' },
    partial_removable_metal: { labelAr: 'طقم جزئي معدني', labelEn: 'Partial Removable Metallic', color: '#92400e', textColor: '#ffffff', border: '#78350f' },
    immediate_denture: { labelAr: 'طقم فوري', labelEn: 'Immediate Denture', color: '#a16207', textColor: '#ffffff', border: '#713f12' },
    denture_add_1_3: { labelAr: 'إضافة 1-3 أسنان للطقم', labelEn: 'Denture Addition (1-3 Teeth)', color: '#ca8a04', textColor: '#ffffff', border: '#854d0e' },
    denture_add_4_9: { labelAr: 'إضافة 4-9 أسنان للطقم', labelEn: 'Denture Addition (4-9 Teeth)', color: '#eab308', textColor: '#1e293b', border: '#a16207' },
    denture_repair: { labelAr: 'تصليح طقم', labelEn: 'Denture Repair', color: '#78350f', textColor: '#ffffff', border: '#451a03' },
    reline_lab: { labelAr: 'تبطين طقم بالمخبر', labelEn: 'Reline in Lab', color: '#a3743a', textColor: '#ffffff', border: '#78350f' },
    reline_clinic: { labelAr: 'تبطين طقم بالعيادة', labelEn: 'Reline in Clinic', color: '#8a6d3b', textColor: '#ffffff', border: '#5c4426' },
    clasp_addition: { labelAr: 'إضافة مشبك للطقم', labelEn: 'Addition of Clasp', color: '#6b4f2c', textColor: '#ffffff', border: '#453519' },

    // Bridges (one procedure spanning several linked teeth; priced per unit)
    bridge_pfm: { labelAr: 'جسر PFM', labelEn: 'Bridge - PFM', color: '#0369a1', textColor: '#ffffff', border: '#075985' },
    bridge_zircon: { labelAr: 'جسر زيركون', labelEn: 'Bridge - Zirconia', color: '#155e75', textColor: '#ffffff', border: '#164e63' },

    // Post & Crown Prep
    post_screw: { labelAr: 'دعامة Screw', labelEn: 'Post - Screw', color: '#6366f1', textColor: '#ffffff', border: '#3730a3' },
    post_fiber: { labelAr: 'دعامة Fiber', labelEn: 'Post - Fiber', color: '#818cf8', textColor: '#1e293b', border: '#4338ca' },
    post_cast: { labelAr: 'دعامة Cast + Core', labelEn: 'Cast Post & Core', color: '#4338ca', textColor: '#ffffff', border: '#312e81' },
    provisional: { labelAr: 'تلبيسة مؤقتة', labelEn: 'Provisional', color: '#cbd5e1', textColor: '#1e293b', border: '#94a3b8' },
    crown_pfm: { labelAr: 'تلبيسة PFM', labelEn: 'PFM Crown', color: '#eab308', textColor: '#1e293b', border: '#a16207' },
    crown_zircon: { labelAr: 'تلبيسة زيركون', labelEn: 'Zirconia Crown', color: '#ca8a04', textColor: '#ffffff', border: '#854d0e' },
    zirconia_premium: { labelAr: 'زيركون (فئة مميزة)', labelEn: 'Zirconia (Premium)', color: '#a16207', textColor: '#ffffff', border: '#713f12' },
    crown_cementation: { labelAr: 'تركيب تلبيسة (تثبيت)', labelEn: 'Crown Cementation', color: '#fb923c', textColor: '#1e293b', border: '#c2410c' },

    missing: { labelAr: 'مفقود / مخلوع', labelEn: 'Missing', color: '#94a3b8', textColor: '#ffffff', border: '#64748b' },
    fracture: { labelAr: 'كسر في السن', labelEn: 'Fracture', color: '#ec4899', textColor: '#ffffff', border: '#db2777' },

    // Legacy keys kept only so teeth diagnosed before the price-list taxonomy
    // update still render correctly; no longer offered in the picker.
    filling: { labelAr: 'حشوة تجميلية', labelEn: 'Composite Filling', color: '#3b82f6', textColor: '#ffffff', border: '#1d4ed8' },
    root_canal: { labelAr: 'علاج عصب', labelEn: 'Root Canal', color: '#8b5cf6', textColor: '#ffffff', border: '#6d28d9' },
    crown: { labelAr: 'تلبيسة / تاج', labelEn: 'Crown / Bridge', color: '#f59e0b', textColor: '#ffffff', border: '#d97706' },
    extraction: { labelAr: 'بحاجة لخلع', labelEn: 'Needs Extraction', color: '#f97316', textColor: '#ffffff', border: '#ea580c' },
    comp: { labelAr: 'حشوة (Comp)', labelEn: 'Composite Filling (Comp)', color: '#3b82f6', textColor: '#ffffff', border: '#1d4ed8' },
    endo: { labelAr: 'سحب عصب (Endo)', labelEn: 'Root Canal (Endo)', color: '#8b5cf6', textColor: '#ffffff', border: '#6d28d9' },
    bleach: { labelAr: 'تبييض (Bleach)', labelEn: 'Whitening (Bleach)', color: '#f472b6', textColor: '#ffffff', border: '#db2777' },
    crown_implant: { labelAr: 'تلبيسة على زرعة', labelEn: 'Crown on Implant', color: '#a16207', textColor: '#ffffff', border: '#713f12' },
    cement_crown: { labelAr: 'تركيب تلبيسة قديمة', labelEn: 'Cementation - Old Crown', color: '#fb923c', textColor: '#1e293b', border: '#c2410c' },
    cement_bridge: { labelAr: 'تركيب جسر قديم', labelEn: 'Cementation - Old Bridge', color: '#ea580c', textColor: '#ffffff', border: '#9a3412' }
};

function toothConditionLabel(key) {
    const c = TOOTH_CONDITIONS[key] || TOOTH_CONDITIONS.healthy;
    return T(c.labelAr, c.labelEn);
}

// Kept in TOOTH_CONDITIONS only to render older records; hidden from the
// legend and the diagnosis picker.
const LEGACY_CONDITION_KEYS = ['filling', 'root_canal', 'crown', 'extraction', 'comp', 'endo', 'bleach', 'crown_implant', 'cement_crown', 'cement_bridge'];

// Optgroups for the condition/procedure pickers, ordered and grouped to
// match the clinic's official price list (Pricelist.pdf) layout.
const CONDITION_CATEGORIES = [
    { labelAr: 'عام', labelEn: 'General', keys: ['checkup', 'xray'] },
    { labelAr: 'حشوات وتجميل', labelEn: 'Fillings & Cosmetic', keys: ['comp_cl1', 'comp_cl2', 'comp_cl5', 'comp_veneer', 'celluloid_crown', 'emax_veneer'] },
    { labelAr: 'لثة', labelEn: 'Periodontics', keys: ['scaling', 'crown_lengthening'] },
    { labelAr: 'علاج عصب', labelEn: 'Endodontics', keys: ['access_opening', 'endo_1canal', 'endo_2canal', 'endo_34canal', 'retreat_1canal', 'retreat_2canal', 'retreat_3canal', 'vital_pulp', 'revasc'] },
    { labelAr: 'أطفال', labelEn: 'Pedo', keys: ['pulpotomy', 'pulpo_comp', 'pulpo_ssc', 'pulpectomy', 'pulpecto_comp', 'pulpecto_ssc', 'ssc', 'band_loop', 'lingual_arch', 'tpa', 'nance', 'fluoride', 'sealant'] },
    { labelAr: 'تقويم وأجهزة', labelEn: 'Orthodontic & Appliances', keys: ['malocclusion_device', 'retainer', 'night_guard'] },
    { labelAr: 'تبييض', labelEn: 'Whitening', keys: ['whitening_trays', 'whitening_syringe', 'whitening_home', 'whitening_office', 'whitening_home_office'] },
    { labelAr: 'جراحة الفم', labelEn: 'Oral Surgery', keys: ['ext_pedo', 'ext', 'ext_root', 'ext_wisdom', 'ext_wisdom_impacted', 'frenectomy', 'root_amputation', 'sinus_lift', 'implant'] },
    { labelAr: 'أطقم متحركة', labelEn: 'Removable Prosthodontics', keys: ['flipper', 'denture_complete_single', 'denture_complete_both', 'partial_removable', 'partial_removable_metal', 'immediate_denture', 'denture_add_1_3', 'denture_add_4_9', 'denture_repair', 'reline_lab', 'reline_clinic', 'clasp_addition'] },
    { labelAr: 'جسور', labelEn: 'Bridges', keys: ['bridge_pfm', 'bridge_zircon'] },
    { labelAr: 'دعامات وتلبيس', labelEn: 'Post & Crown Prep', keys: ['post_screw', 'post_fiber', 'post_cast', 'provisional', 'crown_pfm', 'crown_zircon', 'zirconia_premium', 'crown_cementation'] },
    { labelAr: 'أخرى', labelEn: 'Other', keys: ['missing', 'fracture'] }
];

// Services added directly through "Manage Services & Prices" that don't
// match any built-in condition key become selectable diagnoses too — so
// adding a custom procedure there is enough to make it usable on the chart,
// not just a price row nobody can actually select.
const CUSTOM_CONDITION_KEYS = [];
const CUSTOM_CONDITION_CATEGORY = {}; // key -> the category the clinic typed for it
const CUSTOM_CONDITION_PALETTE = ['#f97316', '#0ea5e9', '#a855f7', '#22c55e', '#e11d48', '#eab308', '#14b8a6', '#6366f1', '#f43f5e', '#84cc16'];

// Custom service names/categories are typed by the user, so they are escaped
// before being placed in markup (quotes too: they also land in attributes).
const escapeChartHTML = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function registerCustomConditions(services) {
    CUSTOM_CONDITION_KEYS.forEach(key => { delete TOOTH_CONDITIONS[key]; delete CUSTOM_CONDITION_CATEGORY[key]; });
    CUSTOM_CONDITION_KEYS.length = 0;
    (services || []).forEach((svc, idx) => {
        if (!svc.id || !svc.id.startsWith('srv_custom_')) return;
        const color = CUSTOM_CONDITION_PALETTE[idx % CUSTOM_CONDITION_PALETTE.length];
        TOOTH_CONDITIONS[svc.id] = { labelAr: svc.name, labelEn: svc.name, color, textColor: '#ffffff', border: color };
        CUSTOM_CONDITION_CATEGORY[svc.id] = String(svc.category || '').trim();
        CUSTOM_CONDITION_KEYS.push(svc.id);
    });
}

// Builds the <optgroup>/<option> markup shared by the tooth-diagnosis picker,
// the custom-plan-item picker, and the procedure-report filter, so all three
// always offer the exact same taxonomy instead of three hand-kept lists.
// A custom service (from "Manage Services & Prices") lands in whichever of
// these optgroups its own category text matches (e.g. "Fillings & Cosmetic"
// puts it right next to Composite Class I/II/V); anything else gets its own
// group named after that category, or "Custom Services" if left blank.
function buildConditionOptionsHTML(includeAllOption) {
    let html = includeAllOption ? `<option value="">${T('الكل', 'All')}</option>` : '';
    html += `<option value="healthy">${T(TOOTH_CONDITIONS.healthy.labelAr, TOOTH_CONDITIONS.healthy.labelEn)}</option>`;
    html += `<option value="caries">${T(TOOTH_CONDITIONS.caries.labelAr, TOOTH_CONDITIONS.caries.labelEn)}</option>`;

    const matchesCategory = (key, cat) => {
        const typed = CUSTOM_CONDITION_CATEGORY[key].toLowerCase();
        return typed === cat.labelEn.toLowerCase() || typed === cat.labelAr.toLowerCase();
    };
    const usedCustomKeys = new Set();

    const labelOf = key => T(TOOTH_CONDITIONS[key].labelAr, TOOTH_CONDITIONS[key].labelEn);
    const firstWord = s => String(s).trim().split(/\s+/)[0].toLowerCase();

    CONDITION_CATEGORIES.forEach(cat => {
        html += `<optgroup label="${T(cat.labelAr, cat.labelEn)}">`;
        const keys = cat.keys.filter(k => TOOTH_CONDITIONS[k]);
        // A custom service slots in right after the closest sibling that
        // shares its first word and sorts before it (Composite Class III lands
        // between Class II and Class V), instead of dangling at the end.
        CUSTOM_CONDITION_KEYS.forEach(key => {
            if (usedCustomKeys.has(key) || !matchesCategory(key, cat)) return;
            usedCustomKeys.add(key);
            const label = labelOf(key);
            const cmp = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
            const siblings = keys.map((k, i) => ({ i, l: labelOf(k) })).filter(s => firstWord(s.l) === firstWord(label));
            if (siblings.length === 0) { keys.push(key); return; }
            const before = siblings.filter(s => cmp(s.l, label) < 0);
            const insertAt = before.length ? before[before.length - 1].i + 1 : siblings[0].i;
            keys.splice(insertAt, 0, key);
        });
        keys.forEach(key => {
            html += `<option value="${key}">${escapeChartHTML(labelOf(key))}</option>`;
        });
        html += `</optgroup>`;
    });

    // Remaining custom keys (category left blank, or typed something that
    // doesn't match any built-in group) get their own optgroup(s) instead.
    const leftoverGroups = new Map(); // category label -> keys
    CUSTOM_CONDITION_KEYS.forEach(key => {
        if (usedCustomKeys.has(key)) return;
        const label = CUSTOM_CONDITION_CATEGORY[key] || T('خدمات مخصصة', 'Custom Services');
        if (!leftoverGroups.has(label)) leftoverGroups.set(label, []);
        leftoverGroups.get(label).push(key);
    });
    leftoverGroups.forEach((keys, label) => {
        html += `<optgroup label="${escapeChartHTML(label)}">`;
        keys.forEach(key => {
            const c = TOOTH_CONDITIONS[key];
            html += `<option value="${escapeChartHTML(key)}">${escapeChartHTML(T(c.labelAr, c.labelEn))}</option>`;
        });
        html += `</optgroup>`;
    });

    return html;
}

const TEETH_DATA = {
    adult: {
        upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
        upperLeft:  [21, 22, 23, 24, 25, 26, 27, 28],
        lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
        lowerLeft:  [31, 32, 33, 34, 35, 36, 37, 38]
    },
    child: {
        upperRight: [55, 54, 53, 52, 51],
        upperLeft:  [61, 62, 63, 64, 65],
        lowerRight: [85, 84, 83, 82, 81],
        lowerLeft:  [71, 72, 73, 74, 75]
    }
};

// Teeth in the order they sit along each arch (left to right on the chart),
// so "adjacent" for a bridge means neighbours in these lists — including
// across the midline (11 next to 21).
const ARCH_SEQUENCES = [
    [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
    [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
    [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
    [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]
];
const archOf = num => ARCH_SEQUENCES.find(a => a.includes(Number(num)));
const isBridgeKey = key => typeof key === 'string' && key.startsWith('bridge_');

class DentalChartManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.bridgeSelection = {};   // { toothNum: 'abutment' | 'pontic' } while the modal is open
        this.bridgeExistingId = null;
        this.onBridgeUpdatedCallback = null;
        this.currentMode = 'adult'; // 'adult' or 'child'
        this.patientTeeth = {}; // { toothNum: { condition: 'caries', surfaces: ['O', 'M'], notes: '', cost: 50 } }
        this.treatmentPlans = []; // full plan history, used only to list everything done on a tooth in its tooltip
        this.activeTooth = null;
        this.onToothUpdatedCallback = null;
    }

    setTeethData(teethRecord = {}, ageYears = null, treatmentPlans = [], toothNotes = {}) {
        this.patientTeeth = teethRecord || {};
        this.toothNotes = toothNotes || {};
        this.treatmentPlans = treatmentPlans || [];
        // Default to the child (primary teeth) chart for patients under 12;
        // the doctor can still switch modes manually afterward.
        if (ageYears !== null && ageYears !== undefined && ageYears !== '' && !isNaN(Number(ageYears))) {
            this.currentMode = Number(ageYears) < 12 ? 'child' : 'adult';
        }
        this.render();
    }

    getTeethData() {
        return this.patientTeeth;
    }

    setMode(mode) {
        this.currentMode = mode;
        this.render();
    }

    render() {
        if (!this.container) return;
        const data = TEETH_DATA[this.currentMode];

        let html = `
        <div class="chart-wrapper">
            <div class="chart-header-bar">
                <div class="mode-toggles">
                    <button type="button" class="btn-toggle ${this.currentMode === 'adult' ? 'active' : ''}" onclick="window.chartManager.setMode('adult')">
                        👨 ${T('أسنان البالغين (32 سن)', 'Permanent Teeth (32)')}
                    </button>
                    <button type="button" class="btn-toggle ${this.currentMode === 'child' ? 'active' : ''}" onclick="window.chartManager.setMode('child')">
                        👶 ${T('أسنان الأطفال اللبنية (20 سن)', 'Primary Teeth (20)')}
                    </button>
                </div>
            </div>

            <!-- الفك العلوي -->
            <div class="jaw-container upper-jaw">
                <div class="jaw-label">${T('الفك العلوي (Upper Arch) - يمين العيادة / يسار المريض والعكس', 'Upper Arch - Clinic Right / Patient Left (and vice versa)')}</div>
                <div class="quadrants-row">
                    <div class="quadrant upper-right">
                        ${data.upperRight.map(num => this.renderToothItem(num)).join('')}
                    </div>
                    <div class="quadrant-divider"></div>
                    <div class="quadrant upper-left">
                        ${data.upperLeft.map(num => this.renderToothItem(num)).join('')}
                    </div>
                </div>
            </div>

            <!-- خط المنتصف الفاصل -->
            <div class="midline-separator">
                <span>${T('خط الوسط الطبي (Midline)', 'Midline')}</span>
            </div>

            <!-- الفك السفلي -->
            <div class="jaw-container lower-jaw">
                <div class="quadrants-row">
                    <div class="quadrant lower-right">
                        ${data.lowerRight.map(num => this.renderToothItem(num)).join('')}
                    </div>
                    <div class="quadrant-divider"></div>
                    <div class="quadrant lower-left">
                        ${data.lowerLeft.map(num => this.renderToothItem(num)).join('')}
                    </div>
                </div>
                <div class="jaw-label">${T('الفك السفلي (Lower Arch)', 'Lower Arch')}</div>
            </div>
        </div>
        `;

        this.container.innerHTML = html;
    }

    // All treatment-plan entries ever logged against this tooth, oldest
    // first, so a tooth worked on more than once (e.g. a filling, then later
    // scaling) shows its whole history in the tooltip instead of just
    // whatever condition happens to be current.
    getToothHistory(num) {
        return (this.treatmentPlans || [])
            .filter(tp => Number(tp.toothNum) === Number(num))
            .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    }

    renderToothItem(num) {
        const info = this.patientTeeth[num] || { condition: 'healthy', surfaces: [], notes: '', cost: 0 };
        const condObj = TOOTH_CONDITIONS[info.condition] || TOOTH_CONDITIONS.healthy;
        const isMissing = info.condition === 'missing';
        const hasSurfaces = info.surfaces && info.surfaces.length > 0;

        let label = toothConditionLabel(info.condition);

        // Bridge teeth show their role (pontic = the replaced tooth, abutment
        // = a supporting tooth) and get a connector bar to the next tooth in
        // the same bridge.
        let bridgeClass = '';
        let bridgeRoleText = '';
        if (info.bridgeId) {
            bridgeRoleText = info.bridgeRole === 'pontic' ? T('وسيط (Pontic)', 'Pontic') : T('حامل (Abutment)', 'Abutment');
            label = bridgeRoleText;
            bridgeClass = 'in-bridge';
            const arch = archOf(num);
            const next = arch ? arch[arch.indexOf(Number(num)) + 1] : undefined;
            const nextInfo = next !== undefined ? this.patientTeeth[next] : null;
            if (nextInfo && nextInfo.bridgeId === info.bridgeId) {
                bridgeClass += ' bridge-link-next';
                if (Math.floor(Number(num) / 10) !== Math.floor(next / 10)) bridgeClass += ' bridge-link-wide';
            }
        }
        const history = this.getToothHistory(num);
        const statusLabel = status => ({
            planned: T('مجدول', 'Planned'), in_progress: T('قيد التنفيذ', 'In Progress'), completed: T('مكتمل', 'Completed')
        }[status] || status);
        let tooltipText;
        if (info.bridgeId) {
            const bridgePlan = (this.treatmentPlans || []).find(tp => tp.bridgeId === info.bridgeId);
            tooltipText = `${T('سن رقم', 'Tooth No.')} ${num}: ${toothConditionLabel(info.condition)} — ${bridgeRoleText}` +
                (bridgePlan ? `\n${bridgePlan.procedure} (${statusLabel(bridgePlan.status)})` : '');
        } else if (history.length > 0) {
            const lines = history.map(tp => `${tp.procedure} (${statusLabel(tp.status)})`);
            tooltipText = `${T('سن رقم', 'Tooth No.')} ${num}:\n${lines.join('\n')}`;
        } else {
            tooltipText = `${T('سن رقم', 'Tooth No.')} ${num}: ${label}${info.notes ? ' - ' + info.notes : ''}`;
        }
        const visitNotes = ((this.toothNotes || {})[num] || []);
        if (visitNotes.length) {
            tooltipText += `\n${T('ملاحظات الزيارات', 'Visit notes')}:\n` + visitNotes.map(n => `• ${window.app ? window.app.formatDateAR(n.date) : n.date}: ${n.text}`).join('\n');
        }
        const tooltipAttr = tooltipText.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

        // Mesial always faces the midline and distal always faces away from
        // it, so which side of the chart icon they fall on flips between the
        // right-side quadrants (1, 4, 5, 8) and the left-side ones (2, 3, 6, 7).
        const quadrantDigit = Math.floor(Number(num) / 10);
        const isRightSideQuadrant = [1, 4, 5, 8].includes(quadrantDigit);
        const leftSurfaceKey = isRightSideQuadrant ? 'D' : 'M';
        const rightSurfaceKey = isRightSideQuadrant ? 'M' : 'D';

        return `
        <div class="tooth-card ${isMissing ? 'is-missing' : ''} ${info.condition !== 'healthy' ? 'has-issue' : ''} ${bridgeClass}"
             style="--bridge-color:${condObj.color}; --surface-color:${info.condition !== 'healthy' ? condObj.color : '#3b82f6'};"
             onclick="window.chartManager.openToothModal(${num})"
             title="${tooltipAttr}">
            <div class="tooth-number">${num}</div>
            <div class="tooth-visual">
                <svg viewBox="0 0 60 60" class="tooth-svg">
                    <!-- Top surface (Lingual/Palatal) -->
                    <polygon points="10,10 50,10 40,20 20,20" class="surface-poly ${info.surfaces?.includes('L') ? 'selected-surface' : ''}" />
                    <!-- Bottom surface (Buccal/Labial) -->
                    <polygon points="20,40 40,40 50,50 10,50" class="surface-poly ${info.surfaces?.includes('B') ? 'selected-surface' : ''}" />
                    <!-- Left surface (Mesial/Distal, flipped by quadrant) -->
                    <polygon points="10,10 20,20 20,40 10,50" class="surface-poly ${info.surfaces?.includes(leftSurfaceKey) ? 'selected-surface' : ''}" />
                    <!-- Right surface (Distal/Mesial, flipped by quadrant) -->
                    <polygon points="50,10 50,50 40,40 40,20" class="surface-poly ${info.surfaces?.includes(rightSurfaceKey) ? 'selected-surface' : ''}" />
                    <!-- Center surface (Occlusal/Incisal) — coloured only when O itself is selected -->
                    <polygon points="20,20 40,20 40,40 20,40" class="surface-poly ${info.surfaces?.includes('O') ? 'selected-surface' : ''}" />
                </svg>
                ${isMissing ? '<div class="missing-cross">✕</div>' : ''}
            </div>
            <div class="tooth-status-badge" style="background:${condObj.color}; color:${condObj.textColor}; border-color:${condObj.border}">
                ${escapeChartHTML(label)}
            </div>
            ${info.cost ? `<div class="tooth-cost-tag">$${info.cost}</div>` : ''}
            ${visitNotes.length ? `<div style="position:absolute; top:-4px; right:-4px; background:#f59e0b; color:#fff; border-radius:10px; font-size:0.65rem; font-weight:800; padding:1px 5px; line-height:1.3;">📝${visitNotes.length}</div>` : ''}
        </div>
        `;
    }

    getArch(num) { return archOf(num); }

    // Both arches of the dentition (permanent or primary) the tooth belongs to.
    getDentitionArches(num) {
        const i = ARCH_SEQUENCES.findIndex(a => a.includes(Number(num)));
        if (i < 0) return [];
        const base = i < 2 ? 0 : 2;
        return [ARCH_SEQUENCES[base], ARCH_SEQUENCES[base + 1]];
    }

    openToothModal(toothNum) {
        this.activeTooth = toothNum;
        const current = this.patientTeeth[toothNum] || { condition: 'healthy', surfaces: [], notes: '', cost: 0 };

        const modal = document.getElementById('toothActionModal');
        if (!modal) return;

        document.getElementById('modalToothNumDisplay').textContent = toothNum;
        window.app?.setDateInput('toothSessionDate', current.date || window.app.todayISO());
        const searchInput = document.getElementById('toothConditionSearch');
        if (searchInput) searchInput.value = '';
        window.app?.filterToothConditionOptions('');
        document.getElementById('toothConditionSelect').value = current.condition || 'healthy';
        document.getElementById('toothNotesInput').value = current.notes || '';
        document.getElementById('toothCostInput').value = current.cost || '';
        // Completion Status follows the procedure's plan on this tooth (new procedures start In Progress).
        const statusSel = document.getElementById('toothPlanStatus');
        if (statusSel) {
            const plansHere = (this.treatmentPlans || []).filter(tp => Number(tp.toothNum) === Number(toothNum) && tp.condition === current.condition && !tp.bridgeId)
                .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
            const last = plansHere[plansHere.length - 1];
            statusSel.value = last && last.status === 'completed' ? 'completed' : 'in_progress';
            const wrap = document.getElementById('toothPlanStatusWrap');
            if (wrap) wrap.style.display = (isBridgeKey(current.condition) || current.condition === 'healthy' || !current.condition) ? 'none' : '';
        }
        if (window.app) {
            window.app.setDateInput('toothNoteDate', window.app.todayISO());
            const nt = document.getElementById('toothNoteText'); if (nt) nt.value = '';
            window.app.renderToothNotes(true);
        }
        const countSel = document.getElementById('toothCountSelect');
        if (countSel) countSel.value = '1';
        const countWrap = document.getElementById('toothCountWrap');
        if (countWrap) countWrap.style.display = (isBridgeKey(current.condition) || !current.condition || current.condition === 'healthy') ? 'none' : 'flex';
        if (window.app) { window.app.toothUnitPrice = null; window.app.toothPick = new Set(); window.app.renderToothPicker(); }

        // Surfaces checkboxes
        const surfaces = current.surfaces || [];
        ['M', 'O', 'D', 'B', 'L'].forEach(s => {
            const cb = document.getElementById(`surf_${s}`);
            if (cb) cb.checked = surfaces.includes(s);
        });

        // The tongue-side surface is called "palatal" in the upper arch
        // (facing the palate) and "lingual" in the lower arch (facing the
        // tongue) — upper arch tooth numbers have a tens digit of 1, 2, 5, or 6.
        const archTensDigit = Math.floor(Number(toothNum) / 10);
        const isUpperArch = [1, 2, 5, 6].includes(archTensDigit);
        const surfLLabel = document.getElementById('surfLLabel');
        if (surfLLabel) surfLLabel.textContent = isUpperArch ? T('P (حنكي)', 'P (Palatal)') : T('L (لساني)', 'L (Lingual)');

        this.bridgeExistingId = current.bridgeId || null;
        if (isBridgeKey(current.condition)) this.onConditionSelectChanged(current.condition, false);
        else this.showBridgeSection(false);

        modal.style.display = 'flex';
    }

    // ---- Bridge support -------------------------------------------------
    showBridgeSection(show) {
        const el = document.getElementById('bridgeSection');
        if (el) el.style.display = show ? 'block' : 'none';
    }

    // Called when the condition dropdown changes: bridge conditions reveal the
    // tooth picker, everything else hides it.
    onConditionSelectChanged(condition, recomputeCost = true) {
        const statusWrap = document.getElementById('toothPlanStatusWrap');
        if (statusWrap) statusWrap.style.display = (isBridgeKey(condition) || !condition || condition === 'healthy') ? 'none' : '';
        if (!isBridgeKey(condition)) { this.showBridgeSection(false); return; }
        this.initBridgeSelection(this.activeTooth);
        this.showBridgeSection(true);
        this.renderBridgePicker();
        this.updateBridgeSummary(recomputeCost);
    }

    initBridgeSelection(toothNum) {
        const info = this.patientTeeth[toothNum];
        const roles = {};
        if (info && info.bridgeId) {
            Object.entries(this.patientTeeth).forEach(([n, t]) => {
                if (t.bridgeId === info.bridgeId) roles[n] = t.bridgeRole;
            });
        } else {
            // Default: the clicked tooth is the pontic, its two neighbours are abutments.
            const arch = archOf(toothNum) || [];
            const idx = arch.indexOf(Number(toothNum));
            roles[toothNum] = 'pontic';
            [arch[idx - 1], arch[idx + 1]].forEach(n => {
                if (n !== undefined && !(this.patientTeeth[n] && this.patientTeeth[n].bridgeId)) roles[n] = 'abutment';
            });
        }
        this.bridgeSelection = roles;
    }

    renderBridgePicker() {
        const box = document.getElementById('bridgeTeethPicker');
        if (!box) return;
        const arch = archOf(this.activeTooth) || [];
        box.innerHTML = arch.map(n => {
            const role = this.bridgeSelection[n];
            return `<button type="button" class="bridge-chip ${role ? 'role-' + role : ''} ${Number(n) === Number(this.activeTooth) ? 'is-active' : ''}" onclick="window.chartManager.cycleBridgeTooth(${n})">${n}${role ? `<small>${role === 'pontic' ? 'P' : 'A'}</small>` : ''}</button>`;
        }).join('');
    }

    // none -> abutment -> pontic -> none
    cycleBridgeTooth(n) {
        const cur = this.bridgeSelection[n];
        if (!cur) this.bridgeSelection[n] = 'abutment';
        else if (cur === 'abutment') this.bridgeSelection[n] = 'pontic';
        else delete this.bridgeSelection[n];
        this.renderBridgePicker();
        this.updateBridgeSummary(true);
    }

    validateBridge() {
        const arch = archOf(this.activeTooth) || [];
        const teeth = arch.filter(n => this.bridgeSelection[n]);
        const pontics = teeth.filter(n => this.bridgeSelection[n] === 'pontic');
        const abutments = teeth.filter(n => this.bridgeSelection[n] === 'abutment');
        const fail = msg => ({ ok: false, msg, teeth, pontics, abutments });
        if (teeth.length < 2) return fail(T('اختر سنين على الأقل.', 'Select at least two teeth.'));
        if (pontics.length === 0) return fail(T('حدّد سناً واحداً على الأقل كوسيط (P).', 'Mark at least one tooth as pontic (P).'));
        if (abutments.length === 0) return fail(T('حدّد سناً حاملاً واحداً على الأقل (A).', 'Mark at least one tooth as abutment (A).'));
        const idxs = teeth.map(n => arch.indexOf(n));
        if (idxs.some((v, i) => v !== idxs[0] + i)) return fail(T('يجب أن تكون أسنان الجسر متجاورة.', 'Bridge teeth must be next to each other.'));
        if (teeth.some(n => { const t = this.patientTeeth[n]; return t && t.bridgeId && t.bridgeId !== this.bridgeExistingId; })) {
            return fail(T('أحد الأسنان ضمن جسر آخر.', 'One of these teeth already belongs to another bridge.'));
        }
        return { ok: true, teeth, pontics, abutments };
    }

    async updateBridgeSummary(recomputeCost) {
        const summary = document.getElementById('bridgeSummary');
        const v = this.validateBridge();
        if (summary) {
            summary.style.color = v.ok ? 'var(--text-muted)' : 'var(--danger)';
            summary.textContent = v.ok
                ? `${T('عدد الوحدات', 'Units')}: ${v.teeth.length} (${v.abutments.length} ${T('حامل', 'abutment(s)')} + ${v.pontics.length} ${T('وسيط', 'pontic(s)')})`
                : v.msg;
        }
        if (v.ok && recomputeCost && window.app && window.app.lookupConditionPrice) {
            const unit = await window.app.lookupConditionPrice(document.getElementById('toothConditionSelect').value);
            // The catalog price is per unit (one tooth), so the bridge total is
            // that price times the number of teeth in the bridge.
            if (unit !== null) document.getElementById('toothCostInput').value = unit * v.teeth.length;
        }
    }

    // Removes every tooth of a bridge from the chart; returns the numbers removed.
    dissolveBridge(bridgeId) {
        const removed = [];
        Object.keys(this.patientTeeth).forEach(n => {
            if (this.patientTeeth[n].bridgeId === bridgeId) { delete this.patientTeeth[n]; removed.push(Number(n)); }
        });
        return removed;
    }

    saveBridge(condition, notes, cost, sessionDate) {
        const v = this.validateBridge();
        if (!v.ok) {
            if (window.app) window.app.showToast(v.msg, 'warning');
            return false;
        }
        const bridgeId = this.bridgeExistingId || ('br_' + Date.now());
        if (this.bridgeExistingId) this.dissolveBridge(this.bridgeExistingId);
        v.teeth.forEach((n, i) => {
            this.patientTeeth[n] = {
                condition, surfaces: [], notes,
                cost: n === v.pontics[0] ? cost : 0,
                bridgeId, bridgeRole: this.bridgeSelection[n],
                date: sessionDate || (window.app ? window.app.todayISO() : ''),
                updatedAt: new Date().toISOString()
            };
        });
        this.closeModal();
        this.render();
        if (this.onBridgeUpdatedCallback) {
            this.onBridgeUpdatedCallback({ bridgeId, condition, teeth: v.teeth, pontics: v.pontics, cost, sessionDate });
        }
        return true;
    }

    saveActiveTooth() {
        if (!this.activeTooth) return;
        const num = this.activeTooth;
        const condition = document.getElementById('toothConditionSelect').value;
        const notes = document.getElementById('toothNotesInput').value.trim();
        const cost = parseFloat(document.getElementById('toothCostInput').value) || 0;
        const sessionDate = window.app ? window.app.validateDateInput('toothSessionDate', false) : '';
        if (sessionDate === null) return; // invalid date typed — app already showed the warning

        if (isBridgeKey(condition)) { this.saveBridge(condition, notes, cost, sessionDate); return; }

        // Re-diagnosing a bridge tooth as something else breaks that bridge up.
        const oldBridgeId = this.patientTeeth[num] && this.patientTeeth[num].bridgeId;
        if (oldBridgeId) {
            this.dissolveBridge(oldBridgeId);
            if (this.onBridgeUpdatedCallback) this.onBridgeUpdatedCallback({ bridgeId: oldBridgeId, removed: true });
        }

        const surfaces = [];
        ['M', 'O', 'D', 'B', 'L'].forEach(s => {
            const cb = document.getElementById(`surf_${s}`);
            if (cb && cb.checked) surfaces.push(s);
        });
        const planStatus = document.getElementById('toothPlanStatus')?.value === 'completed' ? 'completed' : 'in_progress';

        // "Number of teeth" > 1: the same procedure goes on this tooth and the
        // next ones along the arch; the cost field holds the total, so each tooth gets its share.
        const count = condition === 'healthy' ? 1 : (window.app ? window.app.getToothCount() : 1);
        if (count > 1) {
            const targets = window.app.getToothCountTargets();
            if (targets.length !== count) {
                window.app.showToast(T(`اختر ${count} أسنان بالضبط (المختار حالياً ${targets.length}).`, `Select exactly ${count} teeth (currently ${targets.length}).`), 'warning');
                return;
            }
            const taken = targets.filter(n => n !== Number(num) && this.patientTeeth[n] && (this.patientTeeth[n].condition !== 'healthy' || this.patientTeeth[n].bridgeId));
            if (taken.length) {
                window.app.showToast(T(`الأسنان ${taken.join(', ')} لديها تشخيص مسبق. اختر عدداً أقل أو عدّلها أولاً.`, `Teeth ${taken.join(', ')} already have a diagnosis. Pick a smaller number or edit them first.`), 'warning');
                return;
            }
            const each = Math.round((cost / count) * 100) / 100;
            targets.forEach(n => {
                this.patientTeeth[n] = { condition, surfaces: [...surfaces], notes, cost: each, date: sessionDate || window.app.todayISO(), updatedAt: new Date().toISOString(), planStatus };
            });
            this.closeModal();
            this.render();
            if (this.onToothUpdatedCallback) targets.forEach(n => this.onToothUpdatedCallback(n, this.patientTeeth[n]));
            return;
        }

        if (condition === 'healthy' && surfaces.length === 0 && !notes && cost === 0) {
            delete this.patientTeeth[num];
        } else {
            this.patientTeeth[num] = {
                condition,
                surfaces,
                notes,
                cost,
                date: sessionDate || (window.app ? window.app.todayISO() : ''),
                updatedAt: new Date().toISOString(),
                planStatus
            };
        }

        this.closeModal();
        this.render();

        if (this.onToothUpdatedCallback) {
            this.onToothUpdatedCallback(num, this.patientTeeth[num]);
        }
    }

    // Same as Save, then opens the normal Invoice & Payment window, which
    // picks up the just-saved (un-invoiced) procedure with its tooth and price.
    async saveActiveToothAndInvoice() {
        const condition = document.getElementById('toothConditionSelect')?.value;
        if (!this.activeTooth) return;
        if (!condition || condition === 'healthy' || condition === 'missing') {
            window.app?.showToast(T('اختر إجراءً محاسَباً أولاً لإنشاء فاتورة.', 'Choose a billable procedure first to create an invoice.'), 'warning');
            return;
        }
        this.saveActiveTooth();
        const modal = document.getElementById('toothActionModal');
        if (modal && modal.style.display === 'flex') return; // save was refused (validation message already shown)
        await new Promise(r => setTimeout(r, 300));
        if (window.app) await window.app.openCreateInvoiceModal();
    }

    resetActiveTooth() {
        if (!this.activeTooth) return;
        const bridgeId = this.patientTeeth[this.activeTooth] && this.patientTeeth[this.activeTooth].bridgeId;
        if (bridgeId) {
            this.dissolveBridge(bridgeId);
            this.closeModal();
            this.render();
            if (this.onBridgeUpdatedCallback) this.onBridgeUpdatedCallback({ bridgeId, removed: true });
            return;
        }
        delete this.patientTeeth[this.activeTooth];
        this.closeModal();
        this.render();
        if (this.onToothUpdatedCallback) {
            this.onToothUpdatedCallback(this.activeTooth, null);
        }
    }

    closeModal() {
        const modal = document.getElementById('toothActionModal');
        if (modal) modal.style.display = 'none';
        this.activeTooth = null;
    }
}

// Instantiate globally
window.DentalChartManager = DentalChartManager;
