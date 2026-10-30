/**
 * DentFlow Pro (ToothLogic.ai Architecture)
 * Database & Persistence Layer (IndexedDB)
 */

const DB_NAME = 'DentFlowToothLogicDB';
const DB_VERSION = 6;

class ClinicDB {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. Patients store
                if (!db.objectStoreNames.contains('patients')) {
                    const patientStore = db.createObjectStore('patients', { keyPath: 'id' });
                    patientStore.createIndex('patientCode', 'patientCode', { unique: true });
                    patientStore.createIndex('name', 'name', { unique: false });
                    patientStore.createIndex('phone', 'phone', { unique: false });
                    patientStore.createIndex('createdAt', 'createdAt', { unique: false });
                    patientStore.createIndex('isArchived', 'isArchived', { unique: false });
                }

                // 2. Appointments store
                if (!db.objectStoreNames.contains('appointments')) {
                    const apptStore = db.createObjectStore('appointments', { keyPath: 'id' });
                    apptStore.createIndex('patientId', 'patientId', { unique: false });
                    apptStore.createIndex('date', 'date', { unique: false });
                    apptStore.createIndex('status', 'status', { unique: false });
                }

                // 3. Invoices & Payments store
                if (!db.objectStoreNames.contains('invoices')) {
                    const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id' });
                    invoiceStore.createIndex('patientId', 'patientId', { unique: false });
                    invoiceStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: true });
                    invoiceStore.createIndex('date', 'date', { unique: false });
                }

                if (!db.objectStoreNames.contains('payments')) {
                    const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
                    paymentStore.createIndex('invoiceId', 'invoiceId', { unique: false });
                    paymentStore.createIndex('patientId', 'patientId', { unique: false });
                    paymentStore.createIndex('date', 'date', { unique: false });
                }

                // 4. Services catalog
                if (!db.objectStoreNames.contains('services')) {
                    const serviceStore = db.createObjectStore('services', { keyPath: 'id' });
                    serviceStore.createIndex('category', 'category', { unique: false });
                }

                // 5. Prescriptions
                if (!db.objectStoreNames.contains('prescriptions')) {
                    const rxStore = db.createObjectStore('prescriptions', { keyPath: 'id' });
                    rxStore.createIndex('patientId', 'patientId', { unique: false });
                    rxStore.createIndex('date', 'date', { unique: false });
                }

                // 6. Dental Lab & Aligner Cases (ToothLogic Feature)
                if (!db.objectStoreNames.contains('lab_cases')) {
                    const labStore = db.createObjectStore('lab_cases', { keyPath: 'id' });
                    labStore.createIndex('patientId', 'patientId', { unique: false });
                    labStore.createIndex('status', 'status', { unique: false });
                    labStore.createIndex('dueDate', 'dueDate', { unique: false });
                }

                // 7. Post-treatment Instructions (ToothLogic Feature)
                if (!db.objectStoreNames.contains('instructions')) {
                    db.createObjectStore('instructions', { keyPath: 'id' });
                }

                // 8. Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // 9. Staff accounts (accountability / who-did-what)
                if (!db.objectStoreNames.contains('staff')) {
                    const staffStore = db.createObjectStore('staff', { keyPath: 'id' });
                    staffStore.createIndex('name', 'name', { unique: false });
                }

                // 10. Attachments (X-rays etc.) stored as native Blobs, kept out of
                // the patient record so opening/saving a patient stays fast no
                // matter how many images have accumulated over time.
                if (!db.objectStoreNames.contains('attachments')) {
                    const attachmentStore = db.createObjectStore('attachments', { keyPath: 'id' });
                    attachmentStore.createIndex('patientId', 'patientId', { unique: false });
                }

                // 11. Clinic expenses (rent, supplies, bills...) — separate from
                // patient invoices/payments, which are clinic income.
                if (!db.objectStoreNames.contains('expenses')) {
                    const expenseStore = db.createObjectStore('expenses', { keyPath: 'id' });
                    expenseStore.createIndex('date', 'date', { unique: false });
                }

                // 12. Notifications (lab due-date reminders, next-appointment
                // reminders). One record per triggered reminder, kept whether
                // acknowledged or not so the list stays a real history.
                if (!db.objectStoreNames.contains('notifications')) {
                    const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
                    notifStore.createIndex('acknowledged', 'acknowledged', { unique: false });
                    notifStore.createIndex('type', 'type', { unique: false });
                    notifStore.createIndex('refId', 'refId', { unique: false });
                    notifStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                await this.seedInitialData();
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Mirrors the TOOTH_CONDITIONS taxonomy in chart.js, priced from the
    // clinic's official Pricelist.pdf — every id is 'svc_' + the matching
    // condition key so lookupConditionPrice() can auto-fill treatment costs.
    static get RECOMMENDED_SERVICES() {
        return [
            { id: 'svc_checkup', name: 'Checkup', category: 'General', price: 25 },
            { id: 'svc_xray', name: 'X-Ray', category: 'General', price: 5 },

            { id: 'svc_comp_cl1', name: 'Composite Class I', category: 'Fillings & Cosmetic', price: 45 },
            { id: 'svc_comp_cl2', name: 'Composite Class II', category: 'Fillings & Cosmetic', price: 50 },
            { id: 'svc_comp_cl5', name: 'Composite Class V', category: 'Fillings & Cosmetic', price: 40 },
            { id: 'svc_comp_veneer', name: 'Composite Veneer', category: 'Fillings & Cosmetic', price: 70 },
            { id: 'svc_celluloid_crown', name: 'Celluloid Crown', category: 'Fillings & Cosmetic', price: 65 },
            { id: 'svc_emax_veneer', name: 'E-MAX Veneer', category: 'Fillings & Cosmetic', price: 250 },

            { id: 'svc_scaling', name: 'Scaling', category: 'Periodontics', price: 40 },
            { id: 'svc_crown_lengthening', name: 'Crown Lengthening (1 Tooth)', category: 'Periodontics', price: 65 },

            { id: 'svc_access_opening', name: 'Access Opening + Temp.', category: 'Endodontics', price: 25 },
            { id: 'svc_endo_1canal', name: 'Endo - 1 Canal', category: 'Endodontics', price: 60 },
            { id: 'svc_endo_2canal', name: 'Endo - 2 Canals', category: 'Endodontics', price: 80 },
            { id: 'svc_endo_34canal', name: 'Endo - 3 or 4 Canals', category: 'Endodontics', price: 100 },
            { id: 'svc_retreat_1canal', name: 'Re-treatment - 1 Canal', category: 'Endodontics', price: 80 },
            { id: 'svc_retreat_2canal', name: 'Re-treatment - 2 Canals', category: 'Endodontics', price: 150 },
            { id: 'svc_retreat_3canal', name: 'Re-treatment - 3 Canals', category: 'Endodontics', price: 200 },
            { id: 'svc_vital_pulp', name: 'Vital Pulp Therapy', category: 'Endodontics', price: 100 },
            { id: 'svc_revasc', name: 'Revascularization', category: 'Endodontics', price: 150 },

            { id: 'svc_pulpotomy', name: 'Pulpotomy', category: 'Pedo', price: 50 },
            { id: 'svc_pulpo_comp', name: 'Pulpotomy + Composite', category: 'Pedo', price: 90 },
            { id: 'svc_pulpo_ssc', name: 'Pulpotomy + SSC', category: 'Pedo', price: 110 },
            { id: 'svc_pulpectomy', name: 'Pulpectomy', category: 'Pedo', price: 75 },
            { id: 'svc_pulpecto_comp', name: 'Pulpectomy + Composite', category: 'Pedo', price: 120 },
            { id: 'svc_pulpecto_ssc', name: 'Pulpectomy + SSC', category: 'Pedo', price: 130 },
            { id: 'svc_ssc', name: 'SSC (Pedo Crown)', category: 'Pedo', price: 80 },
            { id: 'svc_band_loop', name: 'Band & Loop', category: 'Pedo', price: 120 },
            { id: 'svc_lingual_arch', name: 'Lingual Arch', category: 'Pedo', price: 180 },
            { id: 'svc_tpa', name: 'TPA (Transpalatal Arch)', category: 'Pedo', price: 150 },
            { id: 'svc_nance', name: 'Nance (Acrylic Button)', category: 'Pedo', price: 170 },
            { id: 'svc_fluoride', name: 'Fluoride (25-30)', category: 'Pedo', price: 25 },
            { id: 'svc_sealant', name: 'Sealant', category: 'Pedo', price: 30 },

            { id: 'svc_malocclusion_device', name: 'Malocclusion Device', category: 'Orthodontic & Appliances', price: 400 },
            { id: 'svc_retainer', name: 'Fixed or Removable Retainer', category: 'Orthodontic & Appliances', price: 100 },
            { id: 'svc_night_guard', name: 'Gouttiere / Night Guard (100-120)', category: 'Orthodontic & Appliances', price: 100 },

            { id: 'svc_whitening_trays', name: 'Home Whitening (Trays Only - U&L)', category: 'Whitening', price: 70 },
            { id: 'svc_whitening_syringe', name: 'Whitening Syringe', category: 'Whitening', price: 45 },
            { id: 'svc_whitening_home', name: 'Home Whitening', category: 'Whitening', price: 200 },
            { id: 'svc_whitening_office', name: 'Office Whitening (Single Session)', category: 'Whitening', price: 300 },
            { id: 'svc_whitening_home_office', name: 'Home & Office Whitening', category: 'Whitening', price: 425 },

            { id: 'svc_ext_pedo', name: 'Extraction (Baby Tooth)', category: 'Oral Surgery', price: 25 },
            { id: 'svc_ext', name: 'Simple Extraction', category: 'Oral Surgery', price: 35 },
            { id: 'svc_ext_root', name: 'Extraction - Remaining Root', category: 'Oral Surgery', price: 30 },
            { id: 'svc_ext_wisdom', name: 'Extraction - Wisdom/Sutures', category: 'Oral Surgery', price: 40 },
            { id: 'svc_ext_wisdom_impacted', name: 'Extraction - Impacted Wisdom', category: 'Oral Surgery', price: 130 },
            { id: 'svc_frenectomy', name: 'Frenectomy', category: 'Oral Surgery', price: 150 },
            { id: 'svc_root_amputation', name: 'Root Amputation / Hemisection', category: 'Oral Surgery', price: 85 },
            { id: 'svc_sinus_lift', name: 'Internal Sinus Lift', category: 'Oral Surgery', price: 200 },
            { id: 'svc_implant', name: 'Dental Implant', category: 'Oral Surgery', price: 750 },

            { id: 'svc_flipper', name: 'Flipper', category: 'Removable Prosthodontics', price: 70 },
            { id: 'svc_denture_complete_single', name: 'Upper OR Lower Complete Denture', category: 'Removable Prosthodontics', price: 315 },
            { id: 'svc_denture_complete_both', name: 'Upper & Lower Complete Denture', category: 'Removable Prosthodontics', price: 600 },
            { id: 'svc_partial_removable', name: 'Upper or Lower Partial Removable', category: 'Removable Prosthodontics', price: 225 },
            { id: 'svc_partial_removable_metal', name: 'Partial Removable Metallic', category: 'Removable Prosthodontics', price: 500 },
            { id: 'svc_immediate_denture', name: 'Immediate Denture', category: 'Removable Prosthodontics', price: 200 },
            { id: 'svc_denture_add_1_3', name: 'Denture Addition (1-3 Teeth)', category: 'Removable Prosthodontics', price: 45 },
            { id: 'svc_denture_add_4_9', name: 'Denture Addition (4-9 Teeth)', category: 'Removable Prosthodontics', price: 55 },
            { id: 'svc_denture_repair', name: 'Denture Repair', category: 'Removable Prosthodontics', price: 50 },
            { id: 'svc_reline_lab', name: 'Reline in Lab', category: 'Removable Prosthodontics', price: 50 },
            { id: 'svc_reline_clinic', name: 'Reline in Clinic', category: 'Removable Prosthodontics', price: 60 },
            { id: 'svc_clasp_addition', name: 'Addition of Clasp', category: 'Removable Prosthodontics', price: 30 },

            { id: 'svc_bridge_pfm', name: 'Bridge - PFM (per unit)', category: 'Bridges', price: 150 },
            { id: 'svc_bridge_zircon', name: 'Bridge - Zirconia (per unit)', category: 'Bridges', price: 150 },

            { id: 'svc_post_screw', name: 'Post - Screw', category: 'Post & Crown Prep', price: 20 },
            { id: 'svc_post_fiber', name: 'Post - Fiber', category: 'Post & Crown Prep', price: 40 },
            { id: 'svc_post_cast', name: 'Cast Post & Core', category: 'Post & Crown Prep', price: 40 },
            { id: 'svc_provisional', name: 'Provisional', category: 'Post & Crown Prep', price: 30 },
            { id: 'svc_crown_pfm', name: 'PFM Crown', category: 'Post & Crown Prep', price: 150 },
            { id: 'svc_crown_zircon', name: 'Zirconia Crown', category: 'Post & Crown Prep', price: 150 },
            { id: 'svc_zirconia_premium', name: 'Zirconia (Premium)', category: 'Post & Crown Prep', price: 230 },
            { id: 'svc_crown_cementation', name: 'Crown Cementation', category: 'Post & Crown Prep', price: 20 }
        ];
    }

    // Ids from the original hardcoded seed and from taxonomy keys retired by
    // the Pricelist.pdf overhaul (superseded by more specific new entries).
    // Removed automatically wherever still found.
    static get LEGACY_DEFAULT_SERVICE_IDS() {
        return [
            'srv_1', 'srv_2', 'srv_3', 'srv_4', 'srv_5', 'srv_6', 'srv_7', 'srv_8', 'srv_9', 'srv_10', 'srv_11', 'srv_12', 'srv_13',
            'svc_comp', 'svc_endo', 'svc_bleach', 'svc_crown_implant', 'svc_cement_crown', 'svc_cement_bridge'
        ];
    }

    // Removes the old default catalog if still present and adds any missing
    // recommended category — safe to call anytime (every app launch, or by
    // hand from Settings): it never deletes or overwrites a service the
    // clinic added or already priced.
    async syncRecommendedServicesCatalog() {
        const services = await this.getAll('services');
        const serviceIds = new Set(services.map(s => s.id));

        for (const oldId of ClinicDB.LEGACY_DEFAULT_SERVICE_IDS) {
            if (serviceIds.has(oldId)) await this.delete('services', oldId);
        }

        for (const srv of ClinicDB.RECOMMENDED_SERVICES) {
            if (!serviceIds.has(srv.id)) await this.put('services', srv);
        }
    }

    // One-time migration: the clinic's official Pricelist.pdf replaces
    // whatever prices/names were in the services catalog before it (even
    // ids that still exist under the same key, like svc_ext) with the exact
    // numbers from that file. Runs once per browser install — afterward the
    // catalog behaves normally again and the doctor's own edits stick.
    async migrateToPricelistCatalog() {
        const flag = await this.get('settings', 'services_pricelist_v1_applied');
        if (flag?.value) return;

        const services = await this.getAll('services');
        for (const srv of services) {
            await this.delete('services', srv.id);
        }
        for (const srv of ClinicDB.RECOMMENDED_SERVICES) {
            await this.put('services', srv);
        }
        await this.put('settings', { key: 'services_pricelist_v1_applied', value: true, updatedAt: new Date().toISOString() });
    }

    async seedInitialData() {
        await this.migrateToPricelistCatalog();
        await this.syncRecommendedServicesCatalog();

        // Post-op Care Guidelines Seed
        const instructions = await this.getAll('instructions');
        const defaultInstructions = [
            {
                id: 'inst_extraction',
                title: 'تعليمات ما بعد خلع الأسنان والجراحة',
                category: 'جراحة وخلع',
                points: [
                    'العض على الشاشة الطبية برفق لمدة 45 إلى 60 دقيقة دون تغييرها أو التحدث كثيراً.',
                    'الامتناع التام عن البصق أو المضمضة أو استخدام الشفاطة (Straw) خلال أول 24 ساعة للحفاظ على الخثرة الدموية.',
                    'تناول الأطعمة اللينة والباردة (زبادي، آيس كريم، شوربة دافئة) وتجنب الأطعمة الساخنة والحارة.',
                    'تجنب التدخين/النرجيلة تماماً لمدة لا تقل عن 24 ساعة لمنع حدوث التهاب العظم الجاف (Dry Socket)',
                    'استخدام كمادات ثلج خارجية على الخد (15 دقيقة وضع و15 دقيقة راحة) في حال وجود انتفاخ.',
                    'الالتزام التام بالمسكنات والمضادات الحيوية الموصوفة حسب جدول المواعيد.'
                ]
            },
            {
                id: 'inst_rootcanal',
                title: 'تعليمات ما بعد جلسة علاج العصب (سحب اللب)',
                category: 'علاج عصب',
                points: [
                    'من الطبيعي الشعور ببعض الحساسية أو الألم الخفيف عند العض على السن لمدة 2-3 أيام، ويتم السيطرة عليه بالمسكنات الموصوفة.',
                    'تجنب المضغ أو قضم الأطعمة القاسية على جهة السن المعالج حتى يتم وضع الحشوة الدائمة أو التاج (Crown).',
                    'في حال سقوط الحشوة المؤقتة يرجى الاتصال بالعيادة فوراً لإعادة وضعها وحماية القنوات من البكتيريا.',
                    'الاستمرار في تنظيف الأسنان بالفرشاة والمعجون كالمعتاد بلطف حول السن المعالج.'
                ]
            },
            {
                id: 'inst_fillings',
                title: 'تعليمات ما بعد الحشوات التجميلية',
                category: 'حشوات',
                points: [
                    'تجنب الأكل حتى يزول مفعول التخدير تماماً (حوالي 2-3 ساعات) لتجنب عض الخد أو الشفة دون قصد.',
                    'قد تلاحظ حساسية مؤقتة للمشروبات الباردة أو الساخنة، وتختفي تدريجياً خلال أيام معدودة.',
                    'إذا شعرت أن الحشوة عالية أو تلامس السن المقابل قبل باقي الأسنان، يرجى مراجعة العيادة لتعديل الإطباق في دقيقة واحدة.'
                ]
            },
            {
                id: 'inst_bleaching',
                title: 'تعليمات ما بعد تبييض الأسنان الاحترافي',
                category: 'تجميل',
                points: [
                    'اتباع "الحمية البيضاء" لمدة 48 ساعة: تجنب القهوة، الشاي والعصائر، الشوكولاتة، الصلصات الملونة، والتدخين والنرجيلة.',
                    'استخدام معجون أسنان مخصص للأسنان الحساسة في حال وجود حساسية خفيفة.',
                    'شرب الماء بكثرة والمحافظة على تفريش الأسنان بانتظام والامتناع عن دواء المضمضة الملون.'
                ]
            }
        ];
        if (instructions.length === 0) {
            for (const inst of defaultInstructions) {
                await this.put('instructions', inst);
            }
        } else {
            // One-time content fix so an existing install picks up wording
            // updates too — safe because there's no edit UI for these, so an
            // overwrite by id can never clobber a clinic's own edit.
            for (const id of ['inst_extraction', 'inst_bleaching']) {
                const updated = defaultInstructions.find(i => i.id === id);
                if (updated) await this.put('instructions', updated);
            }
        }

        const clinicSetting = await this.get('settings', 'clinic_info');
        if (!clinicSetting) {
            await this.put('settings', {
                key: 'clinic_info',
                name: 'Dr. Amani Mneimneh Clinic',
                doctor: 'Dr. Amani Mneimneh',
                specialty: 'Dental & Oral Surgeon',
                phone: '00961 70 000 000',
                address: 'الشارع الرئيسي - برج العيادات التخصصية - الطابق 2',
                currency: '$',
                taxRate: 0,
                autoBackupDays: 3
            });
        }
    }

    // DB Helpers
    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async put(storeName, value) {
        window.dispatchEvent(new CustomEvent('dfp:db-busy', { detail: { active: true } }));
        try {
            const result = await new Promise((resolve, reject) => {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req = store.put(value);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            if (storeName === 'patients' && value && value.patientCode) await this.bumpCounter('patient', value.patientCode);
            if (storeName === 'lab_cases' && value && value.caseNumber) await this.bumpCounter('lab', value.caseNumber);
            return result;
        } finally {
            window.dispatchEvent(new CustomEvent('dfp:db-busy', { detail: { active: false } }));
        }
    }

    async delete(storeName, key) {
        window.dispatchEvent(new CustomEvent('dfp:db-busy', { detail: { active: true } }));
        try {
            return await new Promise((resolve, reject) => {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req = store.delete(key);
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error);
            });
        } finally {
            window.dispatchEvent(new CustomEvent('dfp:db-busy', { detail: { active: false } }));
        }
    }

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.clear();
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    // A photographed X-ray from a phone camera can easily be 4-8MB; stored
    // as-is, a clinic's attachments quickly balloon the database and can blow
    // past the browser's backup-export size limit. Downscaled to a sensible
    // max dimension and re-encoded as JPEG — plenty for viewing on screen —
    // before it's ever written to IndexedDB. Non-images (and anything that
    // fails to decode) are stored untouched.
    async compressImageIfNeeded(file) {
        if (!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
        try {
            const bitmap = await createImageBitmap(file);
            const maxDim = 1600;
            let { width, height } = bitmap;
            const scale = Math.min(1, maxDim / Math.max(width, height));
            width = Math.round(width * scale);
            height = Math.round(height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
            bitmap.close?.();
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
            if (!blob || blob.size >= file.size) return file; // compression didn't actually help — keep the original
            const baseName = (file.name || 'image').replace(/\.[^./\\]+$/, '');
            return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
        } catch (err) {
            console.error('Image compression failed, storing the original file instead:', err);
            return file;
        }
    }

    // Attachments (X-rays etc.) — stored as native Blobs, referenced by id from
    // the owning record instead of embedding the image data inline.
    async saveAttachment(id, patientId, file) {
        const stored = await this.compressImageIfNeeded(file);
        await this.put('attachments', {
            id, patientId, blob: stored, fileName: stored.name || file.name || '', mimeType: stored.type || file.type || '',
            createdAt: new Date().toISOString()
        });
        return id;
    }

    async getAttachment(id) {
        return this.get('attachments', id);
    }

    blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    async dataURLToBlob(dataUrl) {
        const res = await fetch(dataUrl);
        return res.blob();
    }

    // Deletes a patient and everything linked to them in ONE transaction:
    // either all of it is removed or (on any error) none of it is.
    async deletePatientCascade(patientId) {
        const related = ['invoices', 'payments', 'appointments', 'prescriptions', 'lab_cases', 'attachments'];
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['patients', ...related], 'readwrite');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Delete aborted'));
            related.forEach(name => {
                const store = tx.objectStore(name);
                const req = store.getAll();
                req.onsuccess = () => req.result.filter(r => r.patientId === patientId).forEach(r => store.delete(r.id));
            });
            tx.objectStore('patients').delete(patientId);
        });
    }

    // Auto numbers. File/case numbers come from a counter that only ever
    // goes up (kept in settings), so deleting a patient or lab case never
    // causes an old number to be handed out again.
    async getCounter(name) {
        const rec = await this.get('settings', `counter_${name}`);
        return rec ? Number(rec.value) || 0 : 0;
    }

    async bumpCounter(name, code) {
        const match = String(code || '').match(/(\d+)$/);
        if (!match) return;
        const n = Number(match[1]);
        if (n > await this.getCounter(name)) {
            await new Promise((resolve, reject) => {
                const tx = this.db.transaction('settings', 'readwrite');
                const req = tx.objectStore('settings').put({ key: `counter_${name}`, value: n, updatedAt: new Date().toISOString() });
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }

    async getNextPatientCode() {
        const patients = await this.getAll('patients');
        const highestExisting = patients.reduce((h, p) => {
            const m = String(p.patientCode || '').match(/(\d+)$/);
            return Math.max(h, m ? Number(m[1]) : 0);
        }, 0);
        if (patients.length === 0 && await this.getCounter('patient') > 0) {
            await new Promise((resolve, reject) => {
                const tx = this.db.transaction('settings', 'readwrite');
                const req = tx.objectStore('settings').put({ key: 'counter_patient', value: 0, updatedAt: new Date().toISOString() });
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
        const next = Math.max(highestExisting, await this.getCounter('patient')) + 1;
        return `PAT-${String(next).padStart(5, '0')}`;
    }

    async getNextInvoiceNumber() {
        const invoices = await this.getAll('invoices');
        const count = invoices.reduce((highest, invoice) => {
            const match = String(invoice.invoiceNumber || '').match(/-(\d+)$/);
            return Math.max(highest, match ? Number(match[1]) : 0);
        }, 0) + 1;
        const year = new Date().getFullYear();
        return `INV-${year}-${String(count).padStart(4, '0')}`;
    }

    async getNextPaymentNumber() {
        const payments = await this.getAll('payments');
        const count = payments.reduce((highest, payment) => {
            const match = String(payment.receiptNumber || '').match(/-(\d+)$/);
            return Math.max(highest, match ? Number(match[1]) : 0);
        }, 0) + 1;
        return `REC-${String(count).padStart(5, '0')}`;
    }

    async getNextLabCaseNumber() {
        const cases = await this.getAll('lab_cases');
        const highestExisting = cases.reduce((h, c) => {
            const m = String(c.caseNumber || '').match(/(\d+)$/);
            return Math.max(h, m ? Number(m[1]) : 0);
        }, 0);
        const next = Math.max(highestExisting, await this.getCounter('lab')) + 1;
        return `LAB-${String(next).padStart(4, '0')}`;
    }

    // FULL ZERO-DATA-LOSS BACKUP & RESTORE
    async exportFullBackup() {
        const attachments = await this.getAll('attachments');
        const attachmentsSerialized = [];
        for (const att of attachments) {
            attachmentsSerialized.push({
                id: att.id, patientId: att.patientId, fileName: att.fileName, mimeType: att.mimeType,
                createdAt: att.createdAt, dataUrl: await this.blobToDataURL(att.blob)
            });
        }

        const backupData = {
            version: '4.0-ToothLogic',
            exportedAt: new Date().toISOString(),
            clinic: await this.get('settings', 'clinic_info'),
            patients: await this.getAll('patients'),
            appointments: await this.getAll('appointments'),
            invoices: await this.getAll('invoices'),
            payments: await this.getAll('payments'),
            services: await this.getAll('services'),
            prescriptions: await this.getAll('prescriptions'),
            lab_cases: await this.getAll('lab_cases'),
            instructions: await this.getAll('instructions'),
            settings: await this.getAll('settings'),
            staff: await this.getAll('staff'),
            attachments: attachmentsSerialized,
            expenses: await this.getAll('expenses'),
            notifications: await this.getAll('notifications')
        };
        return JSON.stringify(backupData, null, 2);
    }

    async restoreFullBackup(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            const T = (ar, en) => (window.DentFlowI18n ? window.DentFlowI18n.T(ar, en) : ar);
            if (!data.patients || !Array.isArray(data.patients)) {
                throw new Error(T('ملف النسخة الاحتياطية غير صالح أو تالف.', 'The backup file is invalid or corrupted.'));
            }
            const requiredLists = ['appointments', 'invoices', 'payments', 'services', 'prescriptions', 'lab_cases', 'instructions', 'settings', 'staff', 'attachments', 'expenses', 'notifications'];
            if (requiredLists.some(key => data[key] !== undefined && !Array.isArray(data[key]))) {
                throw new Error(T('ملف النسخة الاحتياطية يحتوي على بيانات غير صالحة. لم يتم تعديل أي سجل.', 'The backup file contains invalid data. No records were changed.'));
            }

            // Record ids end up inside onclick="...('id')" handlers, so a backup
            // whose ids contain anything but the characters the app itself
            // generates is refused BEFORE anything is cleared or changed.
            const SAFE_ID = /^[A-Za-z0-9_.#:\-]+$/;
            const idLists = ['patients', 'appointments', 'invoices', 'payments', 'services', 'prescriptions', 'lab_cases', 'instructions', 'staff', 'attachments', 'expenses', 'notifications'];
            const badId = idLists.some(list => (data[list] || []).some(r => !r || (typeof r.id !== 'string' && typeof r.id !== 'number') || !SAFE_ID.test(String(r.id))));
            if (badId) {
                throw new Error(T('ملف النسخة الاحتياطية يحتوي على معرّفات غير صالحة. لم يتم تعديل أي سجل.', 'The backup file contains invalid record ids. No records were changed.'));
            }

            // Clear stores
            // Older backups have no notifications list: leave the current ones alone then.
            const stores = ['patients', 'appointments', 'invoices', 'payments', 'services', 'prescriptions', 'lab_cases', 'instructions', 'settings', 'staff', 'attachments', 'expenses'];
            if (data.notifications !== undefined) stores.push('notifications');
            for (const s of stores) {
                if (this.db.objectStoreNames.contains(s)) {
                    await this.clear(s);
                }
            }

            // Put items
            for (const item of (data.patients || [])) await this.put('patients', item);
            for (const item of (data.appointments || [])) await this.put('appointments', item);
            for (const item of (data.invoices || [])) await this.put('invoices', item);
            for (const item of (data.payments || [])) await this.put('payments', item);
            for (const item of (data.services || [])) await this.put('services', item);
            for (const item of (data.prescriptions || [])) await this.put('prescriptions', item);
            for (const item of (data.lab_cases || [])) await this.put('lab_cases', item);
            for (const item of (data.instructions || [])) await this.put('instructions', item);
            for (const item of (data.settings || [])) await this.put('settings', item);
            for (const item of (data.staff || [])) await this.put('staff', item);
            for (const item of (data.expenses || [])) await this.put('expenses', item);
            for (const item of (data.notifications || [])) await this.put('notifications', item);
            for (const item of (data.attachments || [])) {
                const blob = await this.dataURLToBlob(item.dataUrl);
                await this.put('attachments', {
                    id: item.id, patientId: item.patientId, fileName: item.fileName, mimeType: item.mimeType,
                    createdAt: item.createdAt, blob
                });
            }

            await this.put('settings', { key: 'last_backup_restored', date: new Date().toISOString() });
            return true;
        } catch (err) {
            console.error('Restore error:', err);
            throw err;
        }
    }

}

window.db = new ClinicDB();
