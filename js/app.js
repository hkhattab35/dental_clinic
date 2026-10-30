/**
 * ToothLogic.ai Architecture - Application Controller
 * DentFlow Pro Dental Management System
 */

// Fixed prescription pick-lists, matching the clinic's own approved options —
// picked from a dropdown instead of free text so every printed Rx uses
// consistent, pre-approved wording.
const RX_MEDICATIONS = [
    'Augmentin 1g',
    'Augmentin 625',
    'Augmentin 457mg/5ml',
    'Augmentin 275/5ml',
    'Augmentin ES-600',
    'Brufen 400 mg'
];
const RX_INSTRUCTIONS_AR = [
    'حبة صباحاً وحبة مساءً بعد الأكل لمدة اسبوع',
    'حبة كل 8 ساعات بعد الأكل لمدة اسبوع',
    'حبة كل 4-6 ساعات عند الوجع'
];
const RX_INSTRUCTIONS_EN = [
    'One tablet in the morning and one in the evening after meals for a week',
    'One tablet every 8 hours after meals for a week',
    'One tablet every 4-6 hours as needed for pain'
];
const RX_XRAY_TYPES = [
    'Panoramic Xray',
    'Cephalometric Xray',
    'CBCT for upper right quadrant',
    'CBCT for upper left quadrant',
    'CBCT for lower left quadrant',
    'CBCT for lower right quadrant'
];

class ToothLogicApp {
    // Bilingual pair helper for dynamically-built strings (table rows, toasts,
    // printed reports) that mix static words with patient data and therefore
    // can't be matched as a whole by the dictionary-based DOM translator.
    t(ar, en) {
        return window.DentFlowI18n ? window.DentFlowI18n.T(ar, en) : ar;
    }

    genderLabel(gender) {
        if (gender === 'ذكر' || gender === 'male') return this.t('ذكر', 'Male');
        if (gender === 'أنثى' || gender === 'female') return this.t('أنثى', 'Female');
        return this.t('غير محدد', 'Not specified');
    }

    // Dates are shown to the user in the Arabic/European format DD/MM/YYYY,
    // while the database keeps the safe ISO format YYYY-MM-DD.
    formatDateAR(value) {
        if (!value) return '--';
        const raw = String(value).slice(0, 10);
        let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return m ? `${m[1]}/${m[2]}/${m[3]}` : value;
    }

    dateToISO(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    todayISO() {
        return this.dateToISO(new Date());
    }

    getWeekStart(dateISO) {
        const d = new Date(dateISO + 'T00:00:00');
        // Weeks run Monday–Saturday (the calendar hides Sunday); a Sunday
        // date rolls forward to the Monday that follows it.
        const dow = d.getDay();
        d.setDate(d.getDate() + (dow === 0 ? 1 : 1 - dow));
        return this.dateToISO(d);
    }

    normalizeStoredDate(value) {
        const raw = String(value || '').trim().slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
    }

    // Safe for both text and quoted-attribute positions: quotes are escaped too,
    // so a typed " or ' can never close an attribute like title="..." early.
    escapeHTML(value) {
        const el = document.createElement('div');
        el.textContent = String(value ?? '');
        return el.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Accepts digits, spaces, +, -, and parentheses; requires at least 7 digits
    // so obviously-incomplete numbers are caught without rejecting valid
    // international formats (leading +country code, spaced-out groups, etc.).
    isValidPhone(value) {
        const v = String(value || '').trim();
        if (!v) return true;
        if (!/^[0-9+\-\s()]+$/.test(v)) return false;
        return (v.match(/\d/g) || []).length >= 7;
    }

    getDateInputISO(id) {
        const el = document.getElementById(id);
        if (!el) return '';
        const value = String(el.value || '').trim();
        if (!value) return '';
        let m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) {
            const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
            const d = new Date(year, month - 1, day);
            if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
            return '';
        }
        // Backward compatibility with any old stored/input value.
        m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return value;
        return '';
    }

    setDateInput(id, isoValue) {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = isoValue ? this.formatDateAR(isoValue) : '';
    }

    validateDateInput(id, required = false) {
        const el = document.getElementById(id);
        if (!el) return '';
        const raw = String(el.value || '').trim();
        const iso = this.getDateInputISO(id);
        el.classList.toggle('date-invalid', !!raw && !iso);
        if (required && !iso) {
            this.showToast(this.t('يرجى إدخال التاريخ بصيغة يوم/شهر/سنة: DD/MM/YYYY.', 'Please enter the date as DD/MM/YYYY.'), 'warning');
            el.focus();
            return null;
        }
        if (raw && !iso) {
            this.showToast(this.t('صيغة التاريخ غير صحيحة. استخدم DD/MM/YYYY، مثال: 25/08/2026.', 'Invalid date format. Use DD/MM/YYYY, e.g. 25/08/2026.'), 'warning');
            el.focus();
            return null;
        }
        return iso;
    }

    setupDateInputs() {
        document.querySelectorAll('.date-input').forEach(el => {
            el.setAttribute('placeholder', 'dd/mm/yyyy');
            el.setAttribute('inputmode', 'numeric');
            el.addEventListener('input', () => {
                // Rebuilding the value below resets the caret to the end unless we
                // restore it — otherwise editing a date in place (e.g. fixing the
                // day) makes every keystroke land at the year instead.
                const caretPos = el.selectionStart ?? el.value.length;
                const digitsBeforeCaret = el.value.slice(0, caretPos).replace(/\D/g, '').length;
                let digits = el.value.replace(/\D/g, '').slice(0, 8);
                let formatted;
                if (digits.length > 4) formatted = `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
                else if (digits.length > 2) formatted = `${digits.slice(0,2)}/${digits.slice(2)}`;
                else formatted = digits;
                el.value = formatted;
                el.classList.remove('date-invalid');
                let pos = 0, seen = 0;
                while (pos < formatted.length && seen < digitsBeforeCaret) {
                    if (formatted[pos] !== '/') seen++;
                    pos++;
                }
                el.setSelectionRange(pos, pos);
            });
            el.addEventListener('blur', () => {
                if (el.value.trim()) this.validateDateInput(el.id, false);
            });
            this.attachDatePicker(el);
        });
    }

    // Lets every date-input field also be filled via a native calendar
    // picker, without giving up the existing dd/mm/yyyy manual typing.
    attachDatePicker(el) {
        if (el.dataset.pickerAttached) return;
        el.dataset.pickerAttached = '1';

        const wrapper = document.createElement('div');
        wrapper.className = 'date-input-wrapper';
        // Carry over any inline flex sizing so fields inside a flex row
        // (e.g. next-visit date next to its time input) keep their layout.
        if (el.style.flex) { wrapper.style.flex = el.style.flex; el.style.flex = ''; }
        if (el.style.minWidth) { wrapper.style.minWidth = el.style.minWidth; el.style.minWidth = ''; }

        el.parentNode.insertBefore(wrapper, el);
        wrapper.appendChild(el);

        const hiddenNative = document.createElement('input');
        hiddenNative.type = 'date';
        hiddenNative.className = 'date-input-native';
        hiddenNative.tabIndex = -1;
        wrapper.appendChild(hiddenNative);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'date-input-calendar-btn';
        btn.textContent = '📅';
        btn.title = this.t('اختر تاريخاً من التقويم', 'Pick a date from the calendar');
        wrapper.appendChild(btn);

        btn.addEventListener('click', () => {
            hiddenNative.value = this.getDateInputISO(el.id) || '';
            if (typeof hiddenNative.showPicker === 'function') hiddenNative.showPicker();
            else hiddenNative.focus();
        });

        hiddenNative.addEventListener('change', () => {
            if (!hiddenNative.value) return;
            el.value = this.formatDateAR(hiddenNative.value);
            el.classList.remove('date-invalid');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    getToothConditionLabel(toothNum, fallback = '--') {
        if (!toothNum || !this.activePatient) return fallback;
        const tooth = (this.activePatient.teethRecord || {})[toothNum];
        if (!tooth) return this.t('غير مسجل', 'Not recorded');
        const cond = TOOTH_CONDITIONS[tooth.condition];
        return cond ? this.t(cond.labelAr, cond.labelEn) : (tooth.condition || this.t('غير محدد', 'Not specified'));
    }

    refreshVisitToothStatus() {
        const select = document.getElementById('visitToothNum');
        const status = document.getElementById('visitToothCondition');
        if (!select || !status) return;
        const n = select.value;
        status.textContent = n ? `${this.t('السن', 'Tooth')} ${n}: ${this.getToothConditionLabel(n, this.t('غير مسجل', 'Not recorded'))}` : this.t('اختر رقم السن لعرض الحالة السريرية الحالية من مخطط الأسنان.', 'Select a tooth number to view its current clinical status from the dental chart.');
    }

    // Type-to-filter for "Related Tooth Number": typing digits narrows the
    // dropdown to matching teeth and jumps straight to the first match,
    // instead of relying on the browser's own (unreliable) type-ahead.
    filterVisitToothOptions(query) {
        const q = String(query || '').trim().toLowerCase();
        const select = document.getElementById('visitToothNum');
        if (!select) return;
        let firstMatch = null;
        Array.from(select.children).forEach(node => {
            if (node.tagName === 'OPTION') {
                if (!node.value) { node.hidden = !!q; return; } // "General session" placeholder
                const show = !q || node.textContent.toLowerCase().includes(q) || node.value.includes(q);
                node.hidden = !show;
                if (show && !firstMatch) firstMatch = node;
                return;
            }
            let any = false;
            node.querySelectorAll('option').forEach(o => {
                const show = !q || o.textContent.toLowerCase().includes(q) || o.value.includes(q);
                o.hidden = !show;
                if (show) { any = true; if (!firstMatch) firstMatch = o; }
            });
            node.hidden = !any;
        });
        if (q && firstMatch && select.value !== firstMatch.value) {
            select.value = firstMatch.value;
            this.refreshVisitToothStatus();
        }
    }

    constructor() {
        this.currentTab = 'dashboard';
        this.activePatient = null;
        this.chartManager = null;
        this.editingPatientId = null;
        this.editingAppointmentId = null;
        this.patientDirectoryView = 'active'; // 'active' or 'archived'
        this.interfaceLanguage = 'en';
        this.activeStaff = null;
        this.editingStaffId = null;
        this.appointmentsView = 'table'; // 'table' or 'calendar'
        this.calendarWeekStart = null;
        this.patientsPageSize = 20;
        this.patientsCurrentPage = 1;
        this.patientsFilteredList = [];
        this.editingVisitId = null;
        this.editingInvoiceId = null;
        this.editingLabCaseId = null;
        this.currentReminderNotificationId = null;
        this.brandColor = null;
        this.CHART_PALETTE = ['#0284c7', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'];
    }

    async init() {
        try {
            await window.db.init();
            await this.loadInterfaceLanguage();
            await this.loadTheme();
            await this.refreshCustomConditions();
            this.populateConditionSelects();

            // Setup chart manager
            this.chartManager = new window.DentalChartManager('dental-chart-container');
            window.chartManager = this.chartManager;

            this.chartManager.onToothUpdatedCallback = (toothNum, toothData) => {
                this.handleToothChartUpdate(toothNum, toothData);
            };
            this.chartManager.onBridgeUpdatedCallback = info => this.handleBridgeUpdate(info);

            this.setupEventListeners();
            this.setupDateInputs();

            // Only the opening screen (Today) is loaded at start; every other
            // section loads when it is opened (see switchTab), which keeps
            // start-up fast as the clinic's data grows.
            await this.refreshDashboard();
            await this.checkBackupReminder();
            // Daily automatic backup, a few seconds after start so opening stays fast.
            setTimeout(() => this.runAutoBackupIfDue(), 5000);

            // The clinic works from the appointment calendar, so open there.
            this.setAppointmentsView('calendar');
            this.switchTab('appointments');
            await this.initStaffSystem();

            // Keep "Today's Appointments" current as slots end during the day.
            setInterval(() => { if (this.currentTab === 'dashboard') this.refreshDashboard(); }, 60000);

            // Lab due-date / next-appointment reminders: checked once at
            // startup and every minute after, regardless of which tab is open.
            await this.refreshNotificationBadge();
            await this.checkForDueNotifications();
            setInterval(() => this.checkForDueNotifications(), 60000);

            this.showToast(this.t('تم تحميل النظام بنجاح 🚀', 'System loaded successfully 🚀'), 'success');
        } catch (err) {
            console.error('App init error:', err);
            this.showToast(this.t('خطأ أثناء تهيئة النظام: ', 'Error initializing the system: ') + err.message, 'error');
        }
    }

    setupEventListeners() {
        this.setupGlobalSearch();
        this.setupAutoSuggest();

        // Patient directory search
        const patientSearch = document.getElementById('patientSearchInput');
        if (patientSearch) {
            patientSearch.addEventListener('input', (e) => this.filterPatients(e.target.value));
        }

        // DOB Age Auto calculation
        const dobInput = document.getElementById('patientDob');
        if (dobInput) {
            dobInput.addEventListener('change', (e) => {
                if (e.target.value) {
                    const birthISO = this.getDateInputISO('patientDob');
                    if (!birthISO) return;
                    const birth = new Date(birthISO + 'T00:00:00');
                    const diff = Date.now() - birth.getTime();
                    const age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
                    const ageInput = document.getElementById('patientAge');
                    if (ageInput) ageInput.value = age;
                }
            });
        }

        // Invoice discount input
        const discountInput = document.getElementById('invDiscount');
        if (discountInput) {
            discountInput.addEventListener('input', () => this.calculateInvoiceTotals());
        }

        // Global "..." row-actions menus: close whichever one is open when
        // the user clicks elsewhere, scrolls, or presses Escape.
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.row-actions')) this.closeAllRowActionMenus();
        });
        window.addEventListener('scroll', () => this.closeAllRowActionMenus(), true);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllRowActionMenus();
        });

        // Thin top progress bar that appears while any save/delete is in
        // flight, so the screen doesn't feel unresponsive for a moment.
        window.addEventListener('dfp:db-busy', (e) => {
            const bar = document.getElementById('global-loading-bar');
            if (!bar) return;
            if (e.detail.active) {
                this.dbBusyCount = (this.dbBusyCount || 0) + 1;
                clearTimeout(this.dbBusyHideTimer);
                if (this.dbBusyCount === 1 && !this.dbBusyShowTimer) {
                    this.dbBusyShowTimer = setTimeout(() => bar.classList.add('active'), 120);
                }
            } else {
                this.dbBusyCount = Math.max(0, (this.dbBusyCount || 0) - 1);
                if (this.dbBusyCount === 0) {
                    clearTimeout(this.dbBusyShowTimer);
                    this.dbBusyShowTimer = null;
                    this.dbBusyHideTimer = setTimeout(() => bar.classList.remove('active'), 150);
                }
            }
        });
    }

    // ==========================================
    // ROW ACTIONS MENU ("..." dropdown shared by busy table rows)
    // ==========================================
    // actions: array of {label, icon, onclick, danger} — onclick is a
    // string of real JS (same convention as the rest of this file's inline
    // onclick handlers), so existing per-row action functions are reused
    // as-is, just presented through one compact menu instead of a row of
    // separate buttons that wrap awkwardly on narrow screens.
    buildRowActionsMenu(actions) {
        const items = actions.filter(Boolean).map(a => `
            <button type="button" class="row-actions-item ${a.danger ? 'row-actions-item-danger' : ''}" onclick="${a.onclick}">${a.icon || ''} ${a.label}</button>
        `).join('');
        return `
            <div class="row-actions">
                <button type="button" class="row-actions-trigger" onclick="window.app.toggleRowActions(this)" title="${this.t('إجراءات', 'Actions')}">⋮</button>
                <div class="row-actions-menu">${items}</div>
            </div>
        `;
    }

    toggleRowActions(triggerBtn) {
        const menu = triggerBtn.nextElementSibling;
        const wasOpen = menu.classList.contains('open');
        this.closeAllRowActionMenus();
        if (wasOpen) return;

        const rect = triggerBtn.getBoundingClientRect();
        const isRtl = document.documentElement.getAttribute('dir') !== 'ltr';
        menu.style.top = `${rect.bottom + 4}px`;
        if (isRtl) {
            menu.style.right = `${window.innerWidth - rect.right}px`;
            menu.style.left = 'auto';
        } else {
            menu.style.left = `${rect.left}px`;
            menu.style.right = 'auto';
        }
        menu.classList.add('open');

        requestAnimationFrame(() => {
            const menuRect = menu.getBoundingClientRect();
            if (menuRect.right > window.innerWidth) menu.style.left = `${Math.max(8, window.innerWidth - menuRect.width - 8)}px`;
            if (menuRect.bottom > window.innerHeight) menu.style.top = `${Math.max(8, rect.top - menuRect.height - 4)}px`;
        });
    }

    closeAllRowActionMenus() {
        document.querySelectorAll('.row-actions-menu.open').forEach(m => m.classList.remove('open'));
    }

    // ==========================================
    // AUTO-SUGGEST — typing in these boxes offers what was entered before
    // (patient names, complaints, procedures, labs, notes...). Built from the
    // saved data when a box is focused, so it is always current.
    // ==========================================
    setupAutoSuggest() {
        this.suggestFields = {
            patientName: 'names', apptNewPatientName: 'names', apptPatientSearch: 'names',
            patientReferredBy: 'referred', patientAddress: 'address',
            visitChiefComplaint: 'complaint', visitProcedure: 'procedure', apptProcedure: 'procedure',
            toothConditionSearch: 'conditions', visitProcSearch: 'conditions',
            toothNoteText: 'toothNotes', visitNoteText: 'toothNotes',
            paymentNotes: 'payNotes', expenseDescription: 'expense',
            labNameInput: 'lab', labWorkTypeInput: 'work', orthoEntryTreatment: 'orthoTreat'
        };
        Object.keys(this.suggestFields).forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.setAttribute('list', `dl_${this.suggestFields[id]}`); el.setAttribute('autocomplete', 'off'); }
        });
        document.addEventListener('focusin', e => {
            if (e.target && this.suggestFields[e.target.id] && Date.now() - (this.suggestStamp || 0) > 3000) this.refreshAutoSuggest();
        });
        this.refreshAutoSuggest();
    }

    async refreshAutoSuggest() {
        this.suggestStamp = Date.now();
        try {
            const [patients, appts, labs, expenses, payments] = await Promise.all(['patients', 'appointments', 'lab_cases', 'expenses', 'payments'].map(s => window.db.getAll(s)));
            const uniq = arr => [...new Set(arr.map(x => String(x || '').trim()).filter(x => x && x !== '--'))].sort((a, b) => a.localeCompare(b)).slice(0, 400);
            const visits = patients.flatMap(p => p.visits || []);
            const sets = {
                names: uniq(patients.map(p => p.name)),
                referred: uniq(patients.map(p => p.referredBy)),
                address: uniq(patients.map(p => p.address)),
                complaint: uniq(visits.map(v => v.chiefComplaint)),
                procedure: uniq([...visits.map(v => v.procedureDone), ...appts.map(a => a.procedure)]),
                conditions: uniq(Object.values(TOOTH_CONDITIONS).map(c => this.t(c.labelAr, c.labelEn))),
                toothNotes: uniq(patients.flatMap(p => Object.values(p.toothNotes || {}).flat().map(n => n.text))),
                payNotes: uniq(payments.map(p => p.notes)),
                expense: uniq(expenses.map(e => e.description)),
                lab: uniq(labs.map(c => c.labName)),
                work: uniq(labs.map(c => c.workType)),
                orthoTreat: uniq(patients.flatMap(p => (p.orthoEntries || []).map(e => e.treatment)))
            };
            Object.entries(sets).forEach(([key, values]) => {
                let dl = document.getElementById(`dl_${key}`);
                if (!dl) { dl = document.createElement('datalist'); dl.id = `dl_${key}`; document.body.appendChild(dl); }
                dl.innerHTML = values.map(v => `<option value="${this.attrEscape(v)}"></option>`).join('');
            });
        } catch (err) { console.warn('Auto-suggest refresh failed:', err); }
    }

    // ==========================================
    // DARK MODE
    // ==========================================
    async loadTheme() {
        const saved = await window.db.get('settings', 'ui_theme');
        this.applyTheme(saved?.value === 'dark' ? 'dark' : 'light');
        const brand = await window.db.get('settings', 'brand_color');
        this.brandColor = brand?.value || null;
        this.applyBrandColor();
        const palette = await window.db.get('settings', 'ui_palette');
        this.applyPalette(palette?.value || 'plum');
    }

    // Colour theme of the whole dashboard (sidebar, buttons, accents, table lines).
    applyPalette(name) {
        const valid = ['plum', 'ocean', 'teal', 'emerald', 'indigo', 'slate', 'sunset'];
        const p = valid.includes(name) ? name : 'plum';
        if (p === 'plum') document.documentElement.removeAttribute('data-palette');
        else document.documentElement.setAttribute('data-palette', p);
        document.querySelectorAll('#themeSwatches .theme-swatch').forEach(b => b.classList.toggle('active', b.dataset.palette === p));
    }

    async setPalette(name) {
        // A theme replaces any custom main colour picked earlier.
        if (this.brandColor) { this.brandColor = null; this.applyBrandColor(); await window.db.delete('settings', 'brand_color'); }
        this.applyPalette(name);
        await window.db.put('settings', { key: 'ui_palette', value: name, updatedAt: new Date().toISOString() });
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const select = document.getElementById('settingTheme');
        if (select) select.value = theme;
        // The custom brand colour has separate light/dark shades, so it's
        // re-applied every time the theme itself changes.
        this.applyBrandColor();
    }

    // Appearance lives only in Settings now (no toggle on every screen).
    async setTheme(theme) {
        const next = theme === 'dark' ? 'dark' : 'light';
        this.applyTheme(next);
        await window.db.put('settings', { key: 'ui_theme', value: next, updatedAt: new Date().toISOString() });
    }

    // ==========================================
    // BRAND COLOUR — one picked hue drives --primary/--primary-hover/--primary-light
    // for whichever theme (light/dark) is currently active. Left alone (no
    // custom colour saved) the original hand-tuned CSS defaults are untouched.
    // ==========================================
    hexToHueSat(hex) {
        const m = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i);
        if (!m) return null;
        const r = parseInt(m[1].slice(0, 2), 16) / 255, g = parseInt(m[1].slice(2, 4), 16) / 255, b = parseInt(m[1].slice(4, 6), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
        if (max === min) return { h: 0, s: 0 };
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        let h;
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        return { h: Math.round(h * 60), s: Math.round(s * 100) };
    }

    applyBrandColor() {
        const root = document.documentElement.style;
        if (!this.brandColor) {
            root.removeProperty('--primary');
            root.removeProperty('--primary-hover');
            root.removeProperty('--primary-light');
            return;
        }
        const hs = this.hexToHueSat(this.brandColor);
        if (!hs) return;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const { h, s } = hs;
        const sLight = Math.min(s, 90);
        root.setProperty('--primary', `hsl(${h} ${s}% ${isDark ? 65 : 41}%)`);
        root.setProperty('--primary-hover', `hsl(${h} ${s}% ${isDark ? 75 : 32}%)`);
        root.setProperty('--primary-light', `hsl(${h} ${sLight}% ${isDark ? 16 : 94}%)`);
    }

    async setPrimaryColor(hex) {
        this.brandColor = hex;
        this.applyBrandColor();
        await window.db.put('settings', { key: 'brand_color', value: hex, updatedAt: new Date().toISOString() });
    }

    async resetPrimaryColor() {
        this.brandColor = null;
        this.applyBrandColor();
        await window.db.delete('settings', 'brand_color');
        const input = document.getElementById('settingPrimaryColor');
        if (input) input.value = '#0284c7';
        this.showToast(this.t('تم إعادة اللون الافتراضي.', 'Default colour restored.'), 'info');
    }

    async renderLastBackupInfo() {
        const el = document.getElementById('lastBackupInfo');
        if (!el) return;
        const meta = await window.db.get('settings', 'backup_meta');
        if (!meta?.lastBackupAt) {
            el.style.color = 'var(--danger)';
            el.textContent = this.t('لم يتم أخذ أي نسخة احتياطية بعد على هذا الجهاز.', 'No backup has been saved on this computer yet.');
            return;
        }
        const d = new Date(meta.lastBackupAt);
        const days = Math.floor((Date.now() - d.getTime()) / 86400000);
        el.style.color = days >= 3 ? 'var(--danger)' : 'var(--text-main)';
        el.textContent = `${this.t('آخر نسخة احتياطية', 'Last backup')}: ${this.formatDateAR(this.dateToISO(d))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} (${days === 0 ? this.t('اليوم', 'today') : this.t(`قبل ${days} يوم`, `${days} day(s) ago`)})`;
    }

    // Global search: typing shows matching patients right under the box;
    // clicking one (or pressing Enter for the first) opens the file directly.
    setupGlobalSearch() {
        const input = document.getElementById('globalSearchInput');
        const box = document.getElementById('globalSearchResults');
        if (!input || !box) return;
        let timer = null;
        const hide = () => { box.style.display = 'none'; box.innerHTML = ''; };
        const run = async () => {
            const q = input.value.trim().toLowerCase();
            if (!q) { hide(); return; }
            const patients = (await window.db.getAll('patients')).filter(p => !p.isArchived);
            const matches = patients.filter(p =>
                String(p.name || '').toLowerCase().includes(q) ||
                String(p.phone || '').includes(q) ||
                String(p.altPhone || '').includes(q) ||
                String(p.patientCode || '').toLowerCase().includes(q)
            ).slice(0, 8);
            box.innerHTML = matches.length
                ? matches.map(p => `<div class="global-search-item" data-id="${p.id}"><strong>${this.escapeHTML(p.name)}</strong><small>${this.escapeHTML(p.patientCode || '')} ${p.phone ? '· ' + this.escapeHTML(p.phone) : ''}</small></div>`).join('')
                : `<div class="global-search-empty">${this.t('لا توجد نتائج', 'No results')}</div>`;
            box.style.display = 'block';
        };
        input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 120); });
        input.addEventListener('keydown', e => {
            if (e.key === 'Escape') { hide(); input.blur(); }
            if (e.key === 'Enter') {
                const first = box.querySelector('.global-search-item');
                if (first) first.click();
            }
        });
        box.addEventListener('click', e => {
            const item = e.target.closest('.global-search-item');
            if (!item) return;
            this.openPatientProfile(item.dataset.id);
            input.value = '';
            hide();
        });
        document.addEventListener('click', e => { if (!e.target.closest('.global-search-box')) hide(); });
    }

    // Custom rows added through "Manage Services & Prices" (ids starting
    // with srv_custom_) become selectable tooth conditions too, so adding a
    // procedure there is enough to use it on the chart — not just a price.
    async refreshCustomConditions() {
        const services = await window.db.getAll('services');
        registerCustomConditions(services);
    }

    // Regenerates the tooth-diagnosis, custom-plan, and procedure-report
    // condition pickers from the shared TOOTH_CONDITIONS taxonomy so all
    // three always stay in sync instead of three hand-kept option lists.
    populateConditionSelects() {
        const toothSel = document.getElementById('toothConditionSelect');
        if (toothSel) toothSel.innerHTML = buildConditionOptionsHTML(false);
        const reportSel = document.getElementById('procReportCondition');
        if (reportSel) reportSel.innerHTML = buildConditionOptionsHTML(true);
    }

    async loadInterfaceLanguage() {
        const saved = await window.db.get('settings', 'ui_language');
        this.interfaceLanguage = saved?.value === 'ar' ? 'ar' : 'en';
        window.DentFlowI18n?.apply(this.interfaceLanguage);
        const select = document.getElementById('settingLanguage');
        if (select) select.value = this.interfaceLanguage;
    }

    async setInterfaceLanguage(language) {
        this.interfaceLanguage = language === 'en' ? 'en' : 'ar';
        await window.db.put('settings', { key: 'ui_language', value: this.interfaceLanguage, updatedAt: new Date().toISOString() });
        window.DentFlowI18n?.apply(this.interfaceLanguage);
        this.populateConditionSelects();
        // Static labels are re-translated in place by the DOM walker above, but
        // dynamically-built content (table rows, patient banner, status text)
        // mixes data with language-dependent words and must be re-rendered from
        // source to reflect the new language, or it stays stuck in whichever
        // language it was last rendered in.
        await this.refreshDashboard();
        await this.loadPatientsList();
        await this.loadAppointmentsList();
        await this.loadLabCasesList();
        await this.loadInstructionsList();
        await this.loadFinancials();
        await this.renderServicesCatalog();
        if (this.activePatient) {
            await this.openPatientProfile(this.activePatient.id, { switchToTab: false });
        }
        this.showToast(this.interfaceLanguage === 'en' ? 'Interface language updated.' : 'تم تغيير لغة الواجهة.');
    }

    // Switches between the sub-tabs inside Accounts & Reports (Financial /
    // Expenses / Registrations / Procedures / Ledger) — purely a display
    // toggle, the underlying report data/functions are untouched.
    setReportsTab(tabName) {
        document.querySelectorAll('.report-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.reportTab === tabName);
        });
        document.querySelectorAll('.report-tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.dataset.reportPane === tabName);
        });
        // Reports whose pickers depend on current data are refreshed on open.
        if (tabName === 'ortho') this.populateOrthoReportPatients();
        if (tabName === 'general') this.openGeneralReport();
        if (tabName === 'due') this.runDueReport();
        if (tabName === 'credit') this.runCreditReport();
    }

    // Tab Navigation
    switchTab(tabId) {
        document.querySelectorAll('.nav-item-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });

        const activePane = document.getElementById(`tab-${tabId}`);
        if (activePane) {
            activePane.classList.add('active');
            this.currentTab = tabId;
        }

        // The quick-search box is not shown on the Settings & Backup page.
        const searchBox = document.querySelector('.global-search-box');
        if (searchBox) {
            searchBox.style.display = tabId === 'settings' ? 'none' : '';
            if (tabId === 'settings') document.getElementById('globalSearchResults')?.classList.remove('active', 'show');
        }

        if (tabId === 'dashboard') this.refreshDashboard();
        if (tabId === 'patients') this.loadPatientsList();
        if (tabId === 'appointments') this.loadAppointmentsList();
        if (tabId === 'lab') this.loadLabCasesList();
        if (tabId === 'care') this.loadInstructionsList();
        if (tabId === 'financials') this.loadFinancials();
        if (tabId === 'settings') { this.loadClinicSettings(); this.renderLastBackupInfo(); this.loadAutoBackupSetting(); }
    }

    // Toast notifications
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;

        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '⚠️';
        if (type === 'warning') icon = '🔔';

        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            toast.style.transition = 'all 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ==========================================
    // 1. DASHBOARD
    // ==========================================
    // Fills a small "<arrow> N% <label>" note under a KPI number, comparing
    // it against a prior value. isMoney formats both sides as dollars in the
    // wording (only matters when the comparison itself is 0 vs 0 → no note).
    renderKpiTrend(elId, current, previous, label, isMoney) {
        const el = document.getElementById(elId);
        if (!el) return;
        current = Number(current) || 0; previous = Number(previous) || 0;
        if (current === 0 && previous === 0) { el.textContent = ''; return; }
        const money = n => `$${n.toFixed(2)}`;
        if (previous <= 0.005) {
            el.className = 'kpi-trend trend-up';
            el.textContent = `▲ ${this.t('جديد', 'new')} ${label}`;
            return;
        }
        const pct = ((current - previous) / previous) * 100;
        const cls = pct > 0.5 ? 'trend-up' : (pct < -0.5 ? 'trend-down' : 'trend-flat');
        const arrow = pct > 0.5 ? '▲' : (pct < -0.5 ? '▼' : '▬');
        el.className = `kpi-trend ${cls}`;
        el.textContent = `${arrow} ${Math.abs(pct).toFixed(0)}% ${label}`;
    }

    // ==========================================
    // LIGHTWEIGHT INLINE-SVG CHARTS (no charting library — a handful of bars
    // or a donut is all these reports need, and it keeps the app dependency-free)
    // ==========================================
    buildBarChartSVG(labels, values, { height = 180 } = {}) {
        const width = 640;
        const max = Math.max(1, ...values);
        const padding = { top: 16, right: 12, bottom: 26, left: 12 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const gap = 10;
        const barW = (chartW - gap * (values.length - 1)) / values.length;
        const bars = values.map((v, i) => {
            const h = (v / max) * chartH;
            const x = padding.left + i * (barW + gap);
            const y = padding.top + (chartH - h);
            return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="4" fill="var(--primary)"><title>${this.escapeHTML(labels[i])}: $${v.toFixed(2)}</title></rect>
                <text x="${(x + barW / 2).toFixed(1)}" y="${(padding.top + chartH + 17).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${this.escapeHTML(labels[i])}</text>`;
        }).join('');
        return `<svg viewBox="0 0 ${width} ${height}" style="width:100%; height:${height}px; display:block;">${bars}</svg>`;
    }

    // A ring, not a filled pie: each segment is drawn as a plain stroked arc
    // (fill:none), so the centre stays naturally see-through — no separate
    // "punch the hole" circle needed.
    buildDonutChartSVG(segments, { size = 180, thickness = 30 } = {}) {
        const total = segments.reduce((s, x) => s + x.value, 0) || 1;
        const r = (size - thickness) / 2;
        const c = size / 2;
        const circumference = 2 * Math.PI * r;
        let offset = 0;
        const arcs = segments.map((seg, i) => {
            const frac = seg.value / total;
            const dash = frac * circumference;
            const el = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${seg.color || this.CHART_PALETTE[i % this.CHART_PALETTE.length]}" stroke-width="${thickness}"
                stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${c} ${c})">
                <title>${this.escapeHTML(seg.label)}: ${seg.value} (${(frac * 100).toFixed(0)}%)</title></circle>`;
            offset += dash;
            return el;
        }).join('');
        return `<svg viewBox="0 0 ${size} ${size}" style="width:${size}px; height:${size}px; flex-shrink:0;">${arcs}</svg>`;
    }

    buildChartLegendHTML(segments) {
        const total = segments.reduce((s, x) => s + x.value, 0) || 1;
        return segments.map((s, i) => `<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:0.85rem;">
            <span style="width:12px; height:12px; border-radius:3px; background:${s.color || this.CHART_PALETTE[i % this.CHART_PALETTE.length]}; flex-shrink:0;"></span>
            <span>${this.escapeHTML(s.label)} — <strong>${s.value}</strong> (${((s.value / total) * 100).toFixed(0)}%)</span>
        </div>`).join('');
    }

    // Trailing 6 calendar months of receipts, independent of whatever date
    // range the report itself is filtered to — a steady trend line to glance at.
    async renderMonthlyRevenueChart() {
        const container = document.getElementById('finRevenueChart');
        if (!container) return;
        const payments = await window.db.getAll('payments');
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString(this.interfaceLanguage === 'ar' ? 'ar' : 'en-US', { month: 'short' }) });
        }
        const totals = months.map(m => payments.filter(p => this.normalizeStoredDate(p.date).startsWith(m.key)).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0));
        container.innerHTML = `<h4 style="margin:0 0 12px 0; font-weight:800;">${this.t('اتجاه المقبوضات — آخر 6 أشهر', 'Revenue Trend — Last 6 Months')}</h4>`
            + this.buildBarChartSVG(months.map(m => m.label), totals);
    }

    async refreshDashboard() {
        const patients = await window.db.getAll('patients');
        const appointments = await window.db.getAll('appointments');
        const payments = await window.db.getAll('payments');
        const invoices = await window.db.getAll('invoices');
        const labCases = await window.db.getAll('lab_cases');

        const activePatients = patients.filter(p => !p.isArchived);
        document.getElementById('dashTotalPatients').textContent = activePatients.length;

        // Use the clinic's local calendar day. toISOString() switches to UTC and
        // caused dashboard counters to show zero late at night in Lebanon.
        const todayStr = this.todayISO();
        const yesterday = new Date(`${todayStr}T00:00:00`); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = this.dateToISO(yesterday);
        const todayAppts = appointments.filter(a => this.normalizeStoredDate(a.date) === todayStr);
        document.getElementById('dashTodayAppts').textContent = todayAppts.length;

        const todayRevenue = payments
            .filter(p => this.normalizeStoredDate(p.date) === todayStr)
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        document.getElementById('dashTodayRevenue').textContent = `$${todayRevenue.toFixed(2)}`;

        // Simple "vs yesterday" / "new this week" notes under the KPI numbers —
        // context at a glance, without turning the dashboard into a report.
        const yesterdayApptsCount = appointments.filter(a => this.normalizeStoredDate(a.date) === yesterdayStr).length;
        const yesterdayRevenue = payments.filter(p => this.normalizeStoredDate(p.date) === yesterdayStr).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        this.renderKpiTrend('dashTodayApptsTrend', todayAppts.length, yesterdayApptsCount, this.t('عن أمس', 'vs yesterday'), false);
        this.renderKpiTrend('dashTodayRevenueTrend', todayRevenue, yesterdayRevenue, this.t('عن أمس', 'vs yesterday'), true);
        const weekAgoStr = this.dateToISO((() => { const d = new Date(`${todayStr}T00:00:00`); d.setDate(d.getDate() - 7); return d; })());
        const newThisWeek = activePatients.filter(p => this.normalizeStoredDate(p.createdAt || '') >= weekAgoStr).length;
        const patientsTrendEl = document.getElementById('dashTotalPatientsTrend');
        if (patientsTrendEl) {
            patientsTrendEl.className = 'kpi-trend trend-up';
            patientsTrendEl.textContent = newThisWeek > 0 ? this.t(`+${newThisWeek} هذا الأسبوع`, `+${newThisWeek} this week`) : '';
        }

        const pendingLab = labCases.filter(c => c.status === 'in_lab');
        document.getElementById('dashPendingLab').textContent = pendingLab.length;

        // Today's agenda
        const agendaTable = document.getElementById('dashTodayApptsTable');
        if (agendaTable) {
            // An appointment drops off today's list once its booked time is over.
            const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
            const isOver = a => {
                if (!a.time) return false;
                return nowMinutes >= this.timeToMinutes(a.time) + this.getApptDuration(a);
            };
            const upcomingAppts = todayAppts.filter(a => !isOver(a));
            if (upcomingAppts.length === 0) {
                agendaTable.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:24px;">لا توجد مواعيد مسجلة لليوم. استخدم زر "حجز موعد" لإضافة مواعيد.</td></tr>`;
            } else {
                agendaTable.innerHTML = upcomingAppts.map(a => {
                    const pat = patients.find(p => p.id === a.patientId);
                    return `
                    <tr>
                        <td><strong style="color:var(--primary); font-size:1rem;">${a.time || '--:--'}</strong></td>
                        <td>${pat ? `<a href="javascript:void(0)" onclick="window.app.openPatientProfile('${pat.id}', { tab: 'teeth' })" style="color:var(--primary); font-weight:700;">${this.escapeHTML(pat.name)}</a>` : this.t('غير محدد', 'Not specified')}</td>
                        <td>${this.escapeHTML(a.procedure) || this.t('كشف واستشارة', 'Checkup & Consultation')}</td>
                        <td><span class="badge ${this.getApptBadgeClass(a.status)}">${this.getApptStatusLabel(a.status)}</span></td>
                        <td>
                            <div style="display:flex; gap:6px; align-items:center;">
                                ${pat ? `<button class="btn btn-primary btn-sm" onclick="window.app.openPatientProfile('${pat.id}', { tab: 'teeth' })">📂 ${this.t('فتح الملف', 'Open file')}</button>` : ''}
                                ${a.status === 'arrived'
                                    ? `<button class="btn btn-success btn-sm" onclick="window.app.quickChangeApptStatus('${a.id}', 'completed')">${this.t('إتمام ✅', 'Complete ✅')}</button>`
                                    : `<button class="btn btn-outline btn-sm" onclick="window.app.quickChangeApptStatus('${a.id}', 'arrived')">✅ ${this.t('وصل', 'Arrived')}</button>`}
                                ${this.buildRowActionsMenu([
                                    { icon: '✏️', label: this.t('تعديل', 'Edit'), onclick: `window.app.openEditAppointmentModal('${a.id}')` },
                                    a.status === 'arrived' ? null : { icon: '✔️', label: this.t('إتمام', 'Complete'), onclick: `window.app.quickChangeApptStatus('${a.id}', 'completed')` }
                                ])}
                            </div>
                        </td>
                    </tr>
                    `;
                }).join('');
            }
        }
    }

    // ==========================================
    // 2. PATIENTS DIRECTORY
    // ==========================================
    setPatientDirectoryView(view) {
        this.patientDirectoryView = view;
        const btnActive = document.getElementById('btnViewActivePatients');
        const btnArchived = document.getElementById('btnViewArchivedPatients');
        if (btnActive && btnArchived) {
            if (view === 'active') {
                btnActive.style.background = 'white';
                btnActive.style.color = 'var(--primary)';
                btnActive.style.fontWeight = 'bold';
                btnActive.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                btnArchived.style.background = 'transparent';
                btnArchived.style.color = '#64748b';
                btnArchived.style.fontWeight = 'normal';
                btnArchived.style.boxShadow = 'none';
            } else {
                btnArchived.style.background = 'white';
                btnArchived.style.color = 'var(--primary)';
                btnArchived.style.fontWeight = 'bold';
                btnArchived.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                btnActive.style.background = 'transparent';
                btnActive.style.color = '#64748b';
                btnActive.style.fontWeight = 'normal';
                btnActive.style.boxShadow = 'none';
            }
        }
        const searchInput = document.getElementById('patientSearchInput');
        if (searchInput && searchInput.value.trim()) {
            this.filterPatients(searchInput.value);
        } else {
            this.loadPatientsList();
        }
    }

    async loadPatientsList() {
        const patients = await window.db.getAll('patients');
        const isArchivedView = this.patientDirectoryView === 'archived';
        const filtered = patients.filter(p => isArchivedView ? p.isArchived === true : !p.isArchived);
        this.renderPatientsTable(filtered);
    }

    sortPatientsByName() {
        const current = this.patientsFilteredList || [];
        this.patientsNameSortDir = this.patientsNameSortDir === 'asc' ? 'desc' : 'asc';
        const dir = this.patientsNameSortDir === 'asc' ? 1 : -1;
        const sorted = [...current].sort((a, b) => dir * String(a.name || '').localeCompare(String(b.name || '')));
        this.renderPatientsTable(sorted, false);
    }

    // Record No. sorts by its number (PAT-00012 < PAT-00100), not as plain text.
    sortPatientsByCode() {
        const current = this.patientsFilteredList || [];
        this.patientsCodeSortDir = this.patientsCodeSortDir === 'asc' ? 'desc' : 'asc';
        const dir = this.patientsCodeSortDir === 'asc' ? 1 : -1;
        const num = p => { const m = String(p.patientCode || '').match(/(\d+)\s*$/); return m ? Number(m[1]) : 0; };
        const sorted = [...current].sort((a, b) => dir * (num(a) - num(b)) || dir * String(a.patientCode || '').localeCompare(String(b.patientCode || '')));
        this.renderPatientsTable(sorted, false);
    }

    sortPatientsByAge() {
        const current = this.patientsFilteredList || [];
        this.patientsAgeSortDir = this.patientsAgeSortDir === 'asc' ? 'desc' : 'asc';
        const dir = this.patientsAgeSortDir === 'asc' ? 1 : -1;
        const sorted = [...current].sort((a, b) => dir * ((parseFloat(a.age) || 0) - (parseFloat(b.age) || 0)));
        this.renderPatientsTable(sorted, false);
    }

    renderPatientsTable(patients, resetPage = true) {
        const tbody = document.getElementById('patientsTableBody');
        if (!tbody) return;

        const isArchivedView = this.patientDirectoryView === 'archived';
        this.patientsFilteredList = patients;
        if (resetPage) this.patientsCurrentPage = 1;

        const pageSize = this.patientsPageSize || 20;
        const totalPages = Math.max(1, Math.ceil(patients.length / pageSize));
        if (this.patientsCurrentPage > totalPages) this.patientsCurrentPage = totalPages;
        if (this.patientsCurrentPage < 1) this.patientsCurrentPage = 1;

        this.renderPatientsPagination(patients.length, totalPages);

        if (patients.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state-row"><span class="empty-state-icon">${isArchivedView ? '📦' : '👥'}</span><span class="empty-state-text">${isArchivedView ? this.t('لا يوجد مرضى مؤرشفين حالياً.', 'No archived patients yet.') : this.t('لا يوجد مرضى مسجلين. انقر على زر "➕ إضافة مريض جديد".', 'No patients registered yet. Click the "➕ Add New Patient" button.')}</span></td></tr>`;
            return;
        }

        const startIdx = (this.patientsCurrentPage - 1) * pageSize;
        const pageItems = patients.slice(startIdx, startIdx + pageSize);

        tbody.innerHTML = pageItems.map(p => {
            const hasAlerts = p.medicalAlerts && Object.values(p.medicalAlerts).some(v => v === true);
            const teethIssues = p.teethRecord ? Object.keys(p.teethRecord).filter(k => p.teethRecord[k].condition !== 'healthy').length : 0;
            const visitsCount = p.visits ? p.visits.length : 0;
            const isArchived = p.isArchived === true;

            return `
            <tr style="${isArchived ? 'opacity:0.9; background:#fafafa;' : ''}">
                <td><strong>${this.escapeHTML(p.patientCode)}</strong></td>
                <td>
                    <div style="font-weight:800; color:var(--primary); cursor:pointer; font-size:0.95rem;" onclick="window.app.openPatientProfile('${p.id}')">
                        ${this.escapeHTML(p.name)}
                    </div>
                    ${hasAlerts ? `<span class="badge badge-rose" style="font-size:0.68rem; margin-top:3px;">⚠️ ${this.t('تنبيه طبي', 'Medical Alert')}</span>` : ''}
                    ${isArchived ? `<span class="badge badge-amber" style="font-size:0.68rem; margin-top:3px;">📦 ${this.t('في الأرشيف', 'Archived')}</span>` : ''}
                </td>
                <td>${p.age || '--'} ${this.t('سنة', 'yrs')} (${this.genderLabel(p.gender)})</td>
                <td>${this.escapeHTML(p.phone || '--')}</td>
                <td><span class="badge badge-blue">${visitsCount} ${this.t('زيارات', 'visits')}</span></td>
                <td><span class="badge ${teethIssues > 0 ? 'badge-amber' : 'badge-green'}">${teethIssues} ${this.t('إجراءات أسنان', 'dental procedures')}</span></td>
                <td>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button class="btn btn-primary btn-sm" onclick="window.app.openPatientProfile('${p.id}')" title="${this.t('فتح الملف السريري ومخطط الأسنان', 'Open clinical record and dental chart')}">📂 ${this.t('الملف السريري', 'Clinical Record')}</button>
                        ${this.buildRowActionsMenu([
                            { icon: '✏️', label: this.t('تعديل', 'Edit'), onclick: `window.app.openEditPatientModal('${p.id}')` },
                            isArchived
                                ? { icon: '♻️', label: this.t('استعادة', 'Restore'), onclick: `window.app.restorePatient('${p.id}')` }
                                : { icon: '📦', label: this.t('أرشفة', 'Archive'), onclick: `window.app.archivePatient('${p.id}')` },
                            { icon: '🗑️', label: this.t('حذف نهائي', 'Delete permanently'), onclick: `window.app.deletePatientPermanently('${p.id}')`, danger: true }
                        ])}
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    renderPatientsPagination(totalCount, totalPages) {
        const container = document.getElementById('patientsPagination');
        if (!container) return;
        if (totalCount === 0) {
            container.innerHTML = '';
            return;
        }
        const page = this.patientsCurrentPage;
        container.innerHTML = `
            <div class="pagination-bar">
                <span class="pagination-count">${this.t(`إجمالي ${totalCount} ${totalCount === 1 ? 'مريض' : 'مرضى'}`, `${totalCount} patient${totalCount === 1 ? '' : 's'} total`)}</span>
                <div class="pagination-controls">
                    <button class="btn btn-outline btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="window.app.goToPatientsPage(${page - 1})">◀ ${this.t('السابق', 'Prev')}</button>
                    <span class="pagination-page">${this.t('صفحة', 'Page')} ${page} / ${totalPages}</span>
                    <button class="btn btn-outline btn-sm" ${page >= totalPages ? 'disabled' : ''} onclick="window.app.goToPatientsPage(${page + 1})">${this.t('التالي', 'Next')} ▶</button>
                </div>
            </div>`;
    }

    goToPatientsPage(page) {
        this.patientsCurrentPage = page;
        this.renderPatientsTable(this.patientsFilteredList || [], false);
    }

    filterPatients(query) {
        window.db.getAll('patients').then(patients => {
            const q = query.trim().toLowerCase();
            const isArchivedView = this.patientDirectoryView === 'archived';
            const filtered = patients.filter(p => {
                const matchArchiveStatus = isArchivedView ? p.isArchived === true : !p.isArchived;
                if (!matchArchiveStatus) return false;
                if (!q) return true;
                return (p.name && p.name.toLowerCase().includes(q)) ||
                       (p.phone && p.phone.includes(q)) ||
                       (p.patientCode && p.patientCode.toLowerCase().includes(q));
            });
            this.renderPatientsTable(filtered);
        });
    }

    async openNewPatientModal() {
        this.editingPatientId = null;
        document.getElementById('patientModalTitle').textContent = this.t('➕ إضافة مريض جديد', '➕ Add New Patient');
        document.getElementById('patientForm').reset();

        const nextCode = await window.db.getNextPatientCode();
        document.getElementById('patientCodeDisplay').value = nextCode;

        this.openModal('patientModal');
    }

    async openEditPatientModal(patientId) {
        this.editingPatientId = patientId;
        const patient = await window.db.get('patients', patientId);
        if (!patient) return;

        document.getElementById('patientModalTitle').textContent = this.t('✏️ تعديل بيانات المريض', '✏️ Edit Patient Details');
        document.getElementById('patientCodeDisplay').value = patient.patientCode;
        document.getElementById('patientName').value = patient.name || '';
        document.getElementById('patientAge').value = patient.age || '';
        this.setDateInput('patientDob', patient.dob || '');
        const genderVal = patient.gender === 'ذكر' ? 'male' : (patient.gender === 'أنثى' ? 'female' : (patient.gender || ''));
        document.getElementById('patientGender').value = genderVal;
        document.getElementById('patientPhone').value = patient.phone || '';
        document.getElementById('patientAltPhone').value = patient.altPhone || '';
        document.getElementById('patientAddress').value = patient.address || '';
        document.getElementById('patientEmergency').value = patient.emergencyContact || '';
        document.getElementById('patientReferredBy').value = patient.referredBy || '';
        document.getElementById('patientNotes').value = patient.notes || '';

        const alerts = patient.medicalAlerts || {};
        ['diabetes', 'bp', 'heart', 'bleeding', 'allergy', 'pregnancy', 'hepatitis', 'smoking', 'cancer', 'chemo'].forEach(key => {
            const cb = document.getElementById(`med_${key}`);
            if (cb) cb.checked = !!alerts[key];
        });
        document.getElementById('medAllergyDetails').value = patient.allergyDetails || '';

        this.openModal('patientModal');
    }

    async savePatient() {
        const name = document.getElementById('patientName').value.trim();
        if (!name) {
            this.showToast(this.t('يرجى إدخال اسم المريض الكامل.', "Please enter the patient's full name."), 'warning');
            return;
        }

        const patientCode = document.getElementById('patientCodeDisplay').value;
        const age = document.getElementById('patientAge').value;
        const dob = this.validateDateInput('patientDob', false);
        if (dob === null) return;
        const gender = document.getElementById('patientGender').value;
        const phone = document.getElementById('patientPhone').value.trim();
        const altPhone = document.getElementById('patientAltPhone').value.trim();
        const address = document.getElementById('patientAddress').value.trim();
        const emergencyContact = document.getElementById('patientEmergency').value.trim();
        const referredBy = document.getElementById('patientReferredBy').value.trim();
        const notes = document.getElementById('patientNotes').value.trim();
        const allergyDetails = document.getElementById('medAllergyDetails').value.trim();

        if (phone && !this.isValidPhone(phone)) {
            this.showToast(this.t('رقم الهاتف الأساسي غير صالح. يرجى إدخال أرقام فقط (7 أرقام على الأقل).', 'The primary phone number is invalid. Please enter digits only (at least 7).'), 'warning');
            document.getElementById('patientPhone').focus();
            return;
        }
        if (altPhone && !this.isValidPhone(altPhone)) {
            this.showToast(this.t('رقم الهاتف البديل غير صالح. يرجى إدخال أرقام فقط (7 أرقام على الأقل).', 'The alternative phone number is invalid. Please enter digits only (at least 7).'), 'warning');
            document.getElementById('patientAltPhone').focus();
            return;
        }

        if (!this.editingPatientId) {
            const existingPatients = await window.db.getAll('patients');
            const nameNorm = name.toLowerCase();
            const duplicate = existingPatients.find(p => !p.isArchived && String(p.name || '').trim().toLowerCase() === nameNorm && phone && p.phone === phone);
            if (duplicate) {
                const proceed = confirm(this.t(
                    `يوجد مريض مسجل مسبقاً بنفس الاسم ورقم الهاتف (${duplicate.patientCode}). هل تريد إضافة مريض جديد بنفس البيانات؟`,
                    `A patient with the same name and phone number already exists (${duplicate.patientCode}). Add a new, separate patient with the same details anyway?`
                ));
                if (!proceed) return;
            }
        }

        const medicalAlerts = {};
        ['diabetes', 'bp', 'heart', 'bleeding', 'allergy', 'pregnancy', 'hepatitis', 'smoking', 'cancer', 'chemo'].forEach(key => {
            const cb = document.getElementById(`med_${key}`);
            if (cb) medicalAlerts[key] = cb.checked;
        });

        let patientObj;
        if (this.editingPatientId) {
            patientObj = await window.db.get('patients', this.editingPatientId);
            patientObj.name = name;
            patientObj.age = age;
            patientObj.dob = dob;
            patientObj.gender = gender;
            patientObj.phone = phone;
            patientObj.altPhone = altPhone;
            patientObj.address = address;
            patientObj.emergencyContact = emergencyContact;
            patientObj.referredBy = referredBy;
            patientObj.notes = notes;
            patientObj.medicalAlerts = medicalAlerts;
            patientObj.allergyDetails = allergyDetails;
            patientObj.updatedAt = new Date().toISOString();
        } else {
            patientObj = {
                id: 'pat_' + Date.now() + '_' + Math.floor(Math.random()*1000),
                patientCode,
                name,
                age,
                dob,
                gender,
                phone,
                altPhone,
                address,
                emergencyContact,
                referredBy,
                notes,
                medicalAlerts,
                allergyDetails,
                teethRecord: {},
                treatmentPlans: [],
                visits: [],
                isArchived: false,
                createdBy: this.activeStaff?.name || null,
                createdAt: new Date().toISOString()
            };
        }

        await window.db.put('patients', patientObj);
        this.closeModal('patientModal');
        this.showToast(this.t('تم حفظ بيانات المريض بنجاح.', 'Patient details saved successfully.'), 'success');

        await this.loadPatientsList();
        await this.refreshDashboard();

        if (this.activePatient && this.activePatient.id === patientObj.id) {
            this.openPatientProfile(patientObj.id);
        }
    }

    async archivePatient(patientId) {
        if (!confirm(this.t('هل تريد أرشفة ملف هذا المريض ونقله إلى قسم الأرشيف؟ يمكنك استرجاعه في أي وقت.', 'Archive this patient record and move it to the Archive? You can restore it anytime.'))) return;
        const p = await window.db.get('patients', patientId);
        if (p) {
            p.isArchived = true;
            await window.db.put('patients', p);
            if (this.activePatient && this.activePatient.id === patientId) {
                this.resetPatientProfileView();
                this.switchTab('patients');
            }
            this.showToast(this.t(`تمت أرشفة ملف المريض (${p.name}) بنجاح 📦`, `Patient record (${p.name}) archived successfully 📦`), 'info');
            await this.loadPatientsList();
            await this.refreshDashboard();
        }
    }

    async restorePatient(patientId) {
        const p = await window.db.get('patients', patientId);
        if (p) {
            p.isArchived = false;
            await window.db.put('patients', p);
            this.showToast(this.t(`تمت استعادة ملف المريض (${p.name}) إلى قائمة المرضى النشطين ✅`, `Patient record (${p.name}) restored to the active list ✅`), 'success');
            await this.loadPatientsList();
            await this.refreshDashboard();
        }
    }

    async deletePatientPermanently(patientId) {
        if (!patientId) return;
        const p = await window.db.get('patients', patientId);
        if (!p) return;

        const confirmMsg = this.t(
            `⚠️ تحذير شديد:\nهل أنت متأكد تماماً من حذف ملف المريض (${p.name}) نهائياً؟\n\nسيتم مسح كافة سجلات المريض، الفحوصات، مخطط الأسنان، الفواتير، والمواعيد المرتبطة به بشكل كامل ودائم من قاعدة البيانات ولا يمكن التراجع عن هذه الخطوة!`,
            `⚠️ Strong Warning:\nAre you absolutely sure you want to permanently delete the patient record (${p.name})?\n\nAll of the patient's records, visits, dental chart, invoices, and related appointments will be permanently and completely erased from the database. This action cannot be undone!`
        );
        if (!confirm(confirmMsg)) return;

        try {
            // Invoices, payments, appointments, prescriptions, lab cases,
            // attachments and the patient record go together, atomically.
            await window.db.deletePatientCascade(patientId);

            if (this.activePatient && this.activePatient.id === patientId) {
                this.resetPatientProfileView();
                this.switchTab('patients');
            }

            this.showToast(this.t(`تم حذف ملف المريض (${p.name}) وكافة بياناته نهائياً 🗑️`, `Patient record (${p.name}) and all its data permanently deleted 🗑️`), 'warning');
            await this.loadPatientsList();
            await this.refreshDashboard();
        } catch (err) {
            console.error('Delete error:', err);
            this.showToast(this.t('حدث خطأ أثناء محاولة الحذف: ', 'An error occurred while deleting: ') + err.message, 'error');
        }
    }

    // Clears the profile view (banner, dental chart, and every per-patient
    // table) so a deleted or archived patient's data can't linger on screen
    // after they're no longer the active patient — switching tabs alone only
    // hides the pane, it doesn't re-render it.
    resetPatientProfileView() {
        this.activePatient = null;
        const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        setText('activePatName', this.t('اختر مريضاً للبدء', 'Select a Patient to Begin'));
        setText('activePatCode', 'PAT-00000');
        setText('activePatAge', '--');
        setText('activePatPhone', '--');
        const referredByWrap = document.getElementById('activePatReferredByWrap');
        if (referredByWrap) referredByWrap.style.display = 'none';
        const clearHTML = id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; };
        clearHTML('activePatAlerts');
        clearHTML('treatmentPlanTableBody');
        clearHTML('visitsTableBody');
        clearHTML('patLabCasesTableBody');
        clearHTML('patInvoicesTableBody');
        clearHTML('patPrescriptionsTableBody');
        clearHTML('patFinancialSummary');
        ['pwRecentActivity', 'pwAccountSummary', 'pwStatementBody', 'pwTimeline', 'pwDocumentsBody'].forEach(clearHTML);
        setText('pwBalance', '$0.00'); setText('pwProcedures', '0'); setText('pwVisits', '0'); setText('pwNextAppt', '--');
        const navBtn = document.getElementById('navProfileBtn');
        if (navBtn) navBtn.style.display = 'none';
        this.workspaceData = null;
        if (this.chartManager) this.chartManager.setTeethData({});
    }

    // ==========================================
    // 3. CLINICAL RECORD & DENTAL CHART
    // ==========================================
    async openPatientProfile(patientId, options = {}) {
        const { switchToTab = true, tab = 'teeth' } = options;
        const patient = await window.db.get('patients', patientId);
        if (!patient) return;
        this.activePatient = patient;
        await this.migratePlannedPlans();

        // Picking a patient from the directory search clears the search box.
        const dirSearch = document.getElementById('patientSearchInput');
        if (dirSearch && dirSearch.value) { dirSearch.value = ''; this.filterPatients(''); }

        document.getElementById('activePatName').textContent = patient.name;
        document.getElementById('activePatCode').textContent = patient.patientCode;
        document.getElementById('activePatAge').textContent = `${patient.age || '--'} ${this.t('سنة', 'yrs')} (${this.genderLabel(patient.gender)})`;
        document.getElementById('activePatPhone').textContent = patient.phone || this.t('بدون هاتف', 'No phone number');
        const referredByWrap = document.getElementById('activePatReferredByWrap');
        if (referredByWrap) {
            if (patient.referredBy) {
                document.getElementById('activePatReferredBy').textContent = patient.referredBy;
                referredByWrap.style.display = 'inline';
            } else {
                referredByWrap.style.display = 'none';
            }
        }

        const badgesContainer = document.getElementById('activePatAlerts');
        badgesContainer.innerHTML = '';
        const alertNames = {
            diabetes: this.t('سكري', 'Diabetes'),
            bp: this.t('ضغط دم', 'Blood Pressure'),
            heart: this.t('أمراض قلب', 'Heart Disease'),
            bleeding: this.t('سيولة/نزيف', 'Bleeding/Clotting'),
            allergy: this.t('حساسية بنسلين/أدوية', 'Medication Allergy'),
            pregnancy: this.t('حمل', 'Pregnancy'),
            hepatitis: this.t('كبد', 'Liver'),
            smoking: this.t('مدخن', 'Smoker'),
            cancer: 'Cancer',
            chemo: 'Chemotherapy'
        };

        if (patient.medicalAlerts) {
            Object.keys(patient.medicalAlerts).forEach(k => {
                if (patient.medicalAlerts[k]) {
                    const span = document.createElement('span');
                    span.className = 'badge badge-rose';
                    span.textContent = `⚠️ ${alertNames[k] || k}`;
                    badgesContainer.appendChild(span);
                }
            });
        }
        if (patient.allergyDetails) {
            const span = document.createElement('span');
            span.className = 'badge badge-amber';
            span.textContent = `${this.t('حساسية', 'Allergy')}: ${patient.allergyDetails}`;
            badgesContainer.appendChild(span);
        }

        if (!patient.toothNotes) patient.toothNotes = {};
        this.chartManager.setTeethData(patient.teethRecord || {}, patient.age, patient.treatmentPlans || [], patient.toothNotes);
        this.renderTreatmentPlans();
        this.renderVisitsLog();
        await this.loadPatientInvoices();
        await this.loadPatientPrescriptions();
        await this.loadPatientLabCases();

        const navBtn = document.getElementById('navProfileBtn');
        if (navBtn) navBtn.style.display = '';
        if (switchToTab) {
            this.setPatientTab(tab);
            this.switchTab('profile');
        }
        this.scheduleWorkspaceRefresh();
    }

    // ==========================================
    // PATIENT WORKSPACE (tabs, overview, timeline, statement, documents)
    // ==========================================
    setPatientTab(name) {
        document.querySelectorAll('.patient-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.ptab === name));
        document.querySelectorAll('.patient-tab-pane').forEach(p => p.classList.toggle('active', p.dataset.ptabPane === name));
    }

    // Several loaders finish by asking for a refresh; coalesce them.
    scheduleWorkspaceRefresh() {
        clearTimeout(this.workspaceRefreshTimer);
        this.workspaceRefreshTimer = setTimeout(() => this.refreshPatientWorkspace(), 60);
    }

    async loadPatientRelatedRecords() {
        const id = this.activePatient.id;
        const [appts, invoices, payments, rxs, labs] = await Promise.all([
            window.db.getAll('appointments'), window.db.getAll('invoices'), window.db.getAll('payments'),
            window.db.getAll('prescriptions'), window.db.getAll('lab_cases')
        ]);
        const mine = list => list.filter(x => x.patientId === id);
        return { appts: mine(appts), invoices: mine(invoices), payments: mine(payments), rxs: mine(rxs), labs: mine(labs) };
    }

    async refreshPatientWorkspace() {
        if (!this.activePatient) return;
        const patientId = this.activePatient.id;
        const data = await this.loadPatientRelatedRecords();
        if (!this.activePatient || this.activePatient.id !== patientId) return;
        this.workspaceData = data;

        const money = n => `$${(Number(n) || 0).toFixed(2)}`;
        // Includes treatment already recorded (a procedure picked with a cost
        // in Record New Session / Procedure & Visit) even before it's been put
        // on an official invoice — otherwise Account looked fully settled right
        // after a session was saved, until someone remembered to invoice it.
        const statementRows = this.getStatementRows(data);
        const billed = statementRows.reduce((s, r) => s + r.debit, 0);
        const paid = statementRows.reduce((s, r) => s + r.credit, 0);
        const balance = billed - paid;
        // A negative balance means the patient paid more than they currently
        // owe — show that as a credit on account (money kept for a future
        // treatment) instead of a confusing "-$20.00" balance.
        const bal = this.describeBalance(balance);

        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setText('pwBalanceLabel', bal.label);
        setText('pwBalance', bal.text);
        const balEl = document.getElementById('pwBalance');
        if (balEl) balEl.style.color = bal.color;
        setText('pwProcedures', (this.activePatient.treatmentPlans || []).length);
        setText('pwVisits', (this.activePatient.visits || []).length);

        const nowKey = `${this.todayISO()}T${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
        const upcoming = data.appts
            .filter(a => a.status !== 'cancelled' && a.status !== 'completed' && `${this.normalizeStoredDate(a.date)}T${a.time || '00:00'}` >= nowKey)
            .sort((a, b) => `${a.date}T${a.time || ''}`.localeCompare(`${b.date}T${b.time || ''}`))[0];
        setText('pwNextAppt', upcoming ? `${this.formatDateAR(upcoming.date)} ${upcoming.time || ''}` : '--');

        const account = document.getElementById('pwAccountSummary');
        if (account) {
            account.innerHTML = `
                <div class="pw-account-row"><span>Total</span><strong>${money(billed)}</strong></div>
                <div class="pw-account-row"><span>Paid</span><strong style="color:var(--success);">${money(paid)}</strong></div>
                <div class="pw-account-row"><span>${bal.label}</span><strong style="color:${bal.color};">${bal.text}</strong></div>`;
        }
        setText('stTotal', money(billed));
        setText('stPaid', money(paid));
        setText('stBalanceLabel', bal.label);
        setText('stBalance', bal.text);
        const stBal = document.getElementById('stBalance');
        if (stBal) stBal.style.color = bal.color;

        this.renderStatement(data, statementRows);
        this.renderPatientTimeline();
        this.renderPatientDocuments();
    }

    // A positive balance is money the patient still owes; a negative one is
    // money they overpaid, kept on file as a credit toward a future
    // treatment — shown as "Credit" rather than a negative balance.
    describeBalance(balance) {
        const money = n => `$${(Number(n) || 0).toFixed(2)}`;
        if (balance > 0.005) return { label: this.t('الرصيد المستحق', 'Balance Due'), text: money(balance), color: 'var(--danger)' };
        if (balance < -0.005) return { label: this.t('رصيد دائن (Credit)', 'Credit on Account'), text: money(-balance), color: 'var(--cyan)' };
        return { label: this.t('الرصيد', 'Balance'), text: money(0), color: 'var(--success)' };
    }

    // A procedure picked with a cost (Record New Session / Procedure & Visit)
    // is money the patient owes from that moment, even before an official
    // invoice is raised for it — shown as its own "not invoiced yet" line so
    // it never looks paid-in-full right after a session is saved.
    getUninvoicedTreatmentRows(data) {
        const invoicedPlanIds = new Set(data.invoices.flatMap(i => (i.items || []).map(it => it.treatmentPlanId).filter(Boolean)));
        return (this.activePatient?.treatmentPlans || [])
            .filter(p => !invoicedPlanIds.has(p.id) && (parseFloat(p.cost) || 0) > 0.005)
            .map(p => {
                const d = this.normalizeStoredDate(p.date || p.createdAt || this.todayISO());
                return {
                    date: d, sort: `${d}T0-${p.createdAt || ''}`, pending: true, kind: 'plan', id: p.id,
                    ref: '--', desc: `${p.procedure || '--'} — ${this.t('غير مفوترة بعد', 'not invoiced yet')}`,
                    debit: parseFloat(p.cost) || 0, credit: 0
                };
            });
    }

    // Debit = charge (invoice or not-yet-invoiced treatment), Credit = payment,
    // with a running balance.
    getStatementRows(data) {
        const rows = [];
        data.invoices.forEach(i => rows.push({
            date: this.normalizeStoredDate(i.date), sort: `${this.normalizeStoredDate(i.date)}T0-${i.createdAt || ''}`,
            ref: i.invoiceNumber || '--', kind: 'invoice', id: i.id,
            desc: (i.items || []).map(x => x.description).join(', '),
            debit: parseFloat(i.netTotal) || 0, credit: 0
        }));
        data.payments.forEach(p => {
            const inv = data.invoices.find(i => i.id === p.invoiceId);
            const method = p.method === 'cash' ? this.t('نقدي', 'Cash') : (p.method === 'card' ? this.t('بطاقة', 'Card') : this.t('تحويل', 'Transfer'));
            rows.push({
                date: this.normalizeStoredDate(p.date), sort: `${this.normalizeStoredDate(p.date)}T1-${p.createdAt || ''}`,
                ref: inv ? inv.invoiceNumber : '--', kind: 'payment', id: p.id, invoiceId: p.invoiceId,
                desc: `${method} ${this.t('دفعة', 'Payment')} ${p.receiptNumber || ''}${p.itemLabel ? ` — ${p.itemLabel}` : ''}`,
                debit: 0, credit: parseFloat(p.amount) || 0
            });
        });
        rows.push(...this.getUninvoicedTreatmentRows(data));
        rows.sort((a, b) => a.sort.localeCompare(b.sort));
        let running = 0;
        rows.forEach(r => { running += r.debit - r.credit; r.balance = running; });
        return rows;
    }

    renderStatement(data, precomputedRows) {
        const body = document.getElementById('pwStatementBody');
        if (!body) return;
        const money = n => `$${(Number(n) || 0).toFixed(2)}`;
        const rows = precomputedRows || this.getStatementRows(data);
        body.innerHTML = rows.length
            ? rows.map(r => `<tr${r.pending ? ' style="opacity:0.85;"' : ''}>
                <td>${this.formatDateAR(r.date)}</td>
                <td><strong>${this.escapeHTML(r.ref)}</strong></td>
                <td>${this.escapeHTML(r.desc)}</td>
                <td>${r.debit ? money(r.debit) : '—'}</td>
                <td>${r.credit ? `<span style="color:var(--success);">${money(r.credit)}</span>` : '—'}</td>
                <td><strong>${money(r.balance)}</strong></td>
                <td>${r.kind ? `<button class="btn btn-danger btn-sm" onclick="window.app.deleteStatementEntry('${r.kind}', '${r.id}')">🗑️ ${this.t('حذف', 'Delete')}</button>` : ''}</td></tr>`).join('')
            : `<tr><td colspan="7" class="empty-state-row"><span class="empty-state-icon">📒</span><span class="empty-state-text">${this.t('لا توجد حركات مالية بعد.', 'No charges or payments yet.')}</span></td></tr>`;
    }

    // Same letterhead/layout as the invoice print ("Treatment Invoice"), so
    // every printed money document out of this app looks like it belongs
    // to the same set — just the title and table swapped for a statement.
    // Shared letterhead used across every printed/exported document in the app:
    // bilingual doctor name (EN left / AR right) with the clinic seal centered.
    buildLetterheadHTML() {
        return `
            <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:16px; border-bottom:2px solid #333; padding-bottom:14px; margin-bottom:22px;">
                <div style="text-align:left;">
                    <h2 style="margin:0; font-size:1.5rem; font-weight:800; color:#111;">Dr. Amani N. Mneimneh</h2>
                    <p style="margin:2px 0 0 0; font-size:1.1rem; color:#333;">Dental &amp; Oral Surgeon</p>
                </div>
                <img src="${window.CLINIC_SEAL_DATA_URI}" alt="Lebanese Dental Association" style="width:92px; height:92px; object-fit:contain; flex-shrink:0;">
                <div style="text-align:right; direction:rtl;">
                    <h2 style="margin:0; font-size:1.3rem; font-weight:800; color:#111;">الدكتورة أماني ناجي منيمنة</h2>
                    <p style="margin:2px 0 0 0; font-size:0.95rem; color:#333;">أخصائية طب وجراحة الفم والأسنان</p>
                </div>
            </div>`;
    }

    // Shared footer: clinic address at the bottom of every printed page.
    buildLetterheadFooterHTML(clinic) {
        return `
            <div style="margin-top:34px; border-top:1px solid #333; padding-top:10px; text-align:center; color:#333; font-size:0.9rem;">
                ${this.escapeHTML(clinic?.address || '')}
            </div>`;
    }

    buildStatementHTML(rows, billed, paid, bal, clinic) {
        const money = n => `$${(Number(n) || 0).toFixed(2)}`;
        const cell = 'border:1px solid #cbd5e1; padding:7px 10px; text-align:center;';
        return `
            ${this.buildLetterheadHTML()}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="color:var(--primary); margin:0;">${this.t('كشف حساب المريض', 'Statement of Account')}</h3>
                <p style="margin:0; color:#475569; font-size:0.9rem;">${this.t('التاريخ', 'Date')}: ${this.formatDateAR(this.todayISO())}</p>
            </div>
            <div style="margin:18px 0; padding:10px; background:#f8fafc; border-radius:6px;">
                <p>${this.t('اسم المريض', 'Patient Name')}: <strong>${this.escapeHTML(this.activePatient.name)}</strong> (${this.escapeHTML(this.activePatient.patientCode)})</p>
            </div>
            <div style="display:flex; gap:30px; margin-bottom:16px;">
                <div>${this.t('إجمالي العلاج', 'Total Treatment')}: <strong>${money(billed)}</strong></div>
                <div>${this.t('المدفوع', 'Paid')}: <strong>${money(paid)}</strong></div>
                <div>${bal.label}: <strong style="color:${bal.color};">${bal.text}</strong></div>
            </div>
            <table style="width:100%; border-collapse:collapse;">
                <thead><tr style="background:#f1f5f9;">
                    <th style="${cell}">${this.t('التاريخ', 'Date')}</th><th style="${cell}">${this.t('رقم الفاتورة', 'Inv No.')}</th><th style="${cell}">${this.t('البيان', 'Description')}</th>
                    <th style="${cell}">${this.t('مدين', 'Debit')}</th><th style="${cell}">${this.t('دائن', 'Credit')}</th><th style="${cell}">${this.t('الرصيد', 'Balance')}</th>
                </tr></thead>
                <tbody>${rows.length ? rows.map(r => `<tr><td style="${cell}">${this.formatDateAR(r.date)}</td><td style="${cell}"><strong>${this.escapeHTML(r.ref)}</strong></td><td style="${cell}">${this.escapeHTML(r.desc)}</td>
                    <td style="${cell}">${r.debit ? money(r.debit) : '—'}</td><td style="${cell}">${r.credit ? money(r.credit) : '—'}</td><td style="${cell}">${money(r.balance)}</td></tr>`).join('')
                    : `<tr><td style="${cell}" colspan="6">${this.t('لا توجد حركات مالية بعد.', 'No charges or payments yet.')}</td></tr>`}</tbody>
            </table>
            ${this.buildLetterheadFooterHTML(clinic)}`;
    }

    async getStatementPrintData() {
        const data = await this.loadPatientRelatedRecords();
        const clinic = await window.db.get('settings', 'clinic_info') || {};
        const rows = this.getStatementRows(data);
        const billed = rows.reduce((s, r) => s + r.debit, 0);
        const paid = rows.reduce((s, r) => s + r.credit, 0);
        const bal = this.describeBalance(billed - paid);
        return { rows, billed, paid, bal, clinic };
    }

    async printPatientStatement() {
        if (!this.activePatient) return;
        const { rows, billed, paid, bal, clinic } = await this.getStatementPrintData();
        document.getElementById('printableContent').innerHTML = this.buildStatementHTML(rows, billed, paid, bal, clinic);
        window.print();
    }

    async exportPatientStatementToPDF() {
        if (!this.activePatient) return;
        const { rows, billed, paid, bal, clinic } = await this.getStatementPrintData();
        const safeName = String(this.activePatient.name || 'Patient').replace(/[^\w؀-ۿ-]+/g, '_');
        await this.exportPrintAreaToPDF(`Statement_${safeName}_${this.todayISO()}.pdf`, this.buildStatementHTML(rows, billed, paid, bal, clinic));
    }

    // One chronological list of everything that happened to this patient.
    buildTimelineEvents() {
        const p = this.activePatient;
        const data = this.workspaceData || { appts: [], invoices: [], payments: [], rxs: [], labs: [] };
        const money = n => `$${(Number(n) || 0).toFixed(2)}`;
        const timeOf = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
        const events = [];
        const add = (type, icon, date, time, title, detail) => {
            const d = this.localDateOf(date);
            if (!d) return;
            events.push({ type, icon, date: d, time: time || '', title, detail: detail || '', sort: `${d}T${time || '00:00'}` });
        };

        data.appts.forEach(a => {
            add('appointment', '📅', a.date, a.time, `${this.t('موعد', 'Appointment')} — ${this.getApptStatusLabel(a.status)}`, a.procedure || '');
            if (a.arrivedAt) add('appointment', '✅', this.dateToISO(new Date(a.arrivedAt)), timeOf(a.arrivedAt), this.t('وصل المريض', 'Patient arrived'), '');
        });
        (p.visits || []).forEach(v => {
            add('visit', '🩺', v.date, timeOf(v.createdAt), this.t('زيارة سريرية', 'Clinical visit'),
                [v.toothNum ? `${this.t('سن', 'Tooth')} ${v.toothNum}` : '', v.procedureDone, v.doctorNotes && v.doctorNotes !== '--' ? v.doctorNotes : ''].filter(Boolean).join(' · '));
            if (v.attachmentId || v.attachment) add('attachment', '🖼️', v.date, timeOf(v.createdAt), this.t('مرفق / صورة أشعة', 'Attachment / X-ray'), v.procedureDone || '');
        });
        (p.treatmentPlans || []).forEach(tp => {
            const status = { planned: this.t('مجدول', 'Planned'), in_progress: this.t('قيد التنفيذ', 'In progress'), completed: this.t('مكتمل', 'Completed') }[tp.status] || tp.status;
            add('procedure', '🦷', tp.date || tp.createdAt, timeOf(tp.createdAt), this.t('إجراء', 'Procedure'), `${tp.procedure} · ${money(tp.cost)} · ${status}`);
        });
        data.invoices.forEach(i => add('invoice', '🧾', i.date, timeOf(i.createdAt), `${this.t('فاتورة', 'Invoice')} ${i.invoiceNumber}`, money(i.netTotal)));
        data.payments.forEach(pay => add('payment', '💵', pay.date, timeOf(pay.createdAt), `${this.t('دفعة', 'Payment')} ${pay.receiptNumber || ''}`,
            `${money(pay.amount)} (${pay.method === 'cash' ? this.t('نقدي', 'Cash') : (pay.method === 'card' ? this.t('بطاقة', 'Card') : this.t('تحويل', 'Transfer'))})${pay.itemLabel ? ' — ' + pay.itemLabel : ''}`));
        data.rxs.forEach(rx => add('prescription', '💊', rx.date, timeOf(rx.createdAt), this.t('وصفة طبية', 'Prescription'),
            [...(rx.medications || []).map(m => m.name), rx.xrayType].filter(Boolean).join(', ')));
        data.labs.forEach(c => add('lab', '🧪', c.sentDate || c.createdAt, timeOf(c.createdAt), `${this.t('طلب مختبر', 'Lab request')} ${c.caseNumber}`, `${c.workType} · ${c.labName}`));

        return events.sort((a, b) => b.sort.localeCompare(a.sort));
    }

    renderTimelineItems(events) {
        return events.map(e => `
            <div class="timeline-item">
                <div class="timeline-icon">${e.icon}</div>
                <div class="timeline-body">
                    <div class="timeline-title">${this.escapeHTML(e.title)}</div>
                    ${e.detail ? `<div class="timeline-detail">${this.escapeHTML(e.detail)}</div>` : ''}
                    <div class="timeline-date">${this.formatDateAR(e.date)}${e.time ? ' ' + e.time : ''}</div>
                </div>
            </div>`).join('');
    }

    renderPatientTimeline() {
        if (!this.activePatient) return;
        const events = this.buildTimelineEvents();
        const recent = document.getElementById('pwRecentActivity');
        const empty = `<div class="empty-state-row" style="padding:24px;"><span class="empty-state-icon">🕘</span><span class="empty-state-text">${this.t('لا توجد أحداث بعد.', 'No activity yet.')}</span></div>`;
        if (recent) recent.innerHTML = events.length ? this.renderTimelineItems(events.slice(0, 6)) : empty;
        const full = document.getElementById('pwTimeline');
        if (full) {
            const filter = document.getElementById('pwTimelineFilter')?.value || '';
            const list = filter ? events.filter(e => e.type === filter) : events;
            full.innerHTML = list.length ? this.renderTimelineItems(list) : empty;
        }
    }

    async renderPatientDocuments() {
        const body = document.getElementById('pwDocumentsBody');
        if (!body || !this.activePatient) return;
        const rows = [];
        (this.activePatient.visits || []).forEach(v => {
            const attId = v.attachmentId || v.attachment;
            if (attId) rows.push({ date: v.date, type: 'X-ray / image', rel: v.procedureDone || (v.toothNum ? `Tooth ${v.toothNum}` : ''), action: `<button class="btn btn-outline btn-sm" onclick="window.app.previewAttachment('${attId}')">🖼️ View</button>` });
        });
        (this.workspaceData?.rxs || []).forEach(rx => rows.push({
            date: rx.date, type: 'Prescription',
            rel: [...(rx.medications || []).map(m => m.name), rx.xrayType].filter(Boolean).join(', '),
            action: `<button class="btn btn-outline btn-sm" onclick="window.app.printPrescription('${rx.id}')">🖨️ Print</button> <button class="btn btn-outline btn-sm" onclick="window.app.exportPrescriptionToPDF('${rx.id}')">📄 PDF</button>`
        }));
        (this.workspaceData?.invoices || []).forEach(i => rows.push({
            date: i.date, type: 'Invoice', rel: i.invoiceNumber,
            action: `<button class="btn btn-outline btn-sm" onclick="window.app.printInvoice('${i.id}')">🖨️ Print</button> <button class="btn btn-outline btn-sm" onclick="window.app.exportInvoiceToPDF('${i.id}')">📄 PDF</button>`
        }));
        rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        body.innerHTML = rows.length
            ? rows.map(r => `<tr><td>${this.formatDateAR(r.date)}</td><td>${r.type}</td><td>${this.escapeHTML(r.rel)}</td><td>${r.action}</td></tr>`).join('')
            : `<tr><td colspan="4" class="empty-state-row"><span class="empty-state-icon">📁</span><span class="empty-state-text">${this.t('لا توجد مستندات بعد.', 'No documents yet.')}</span></td></tr>`;
    }

    async handleToothChartUpdate(toothNum, toothData) {
        if (!this.activePatient) return;
        if (!this.activePatient.teethRecord) this.activePatient.teethRecord = {};

        // The Completion Status chosen in the tooth window applies to the plan, not to the chart record.
        const wantedStatus = toothData && toothData.planStatus === 'completed' ? 'completed' : 'in_progress';
        if (toothData) delete toothData.planStatus;

        if (toothData) {
            this.activePatient.teethRecord[toothNum] = toothData;
            // Choosing a procedure on a tooth means the work is under way:
            // the plan starts "in progress" and its clinical session is
            // created straight away (no separate Start step).
            if (toothData.condition !== 'healthy') {
                const planExists = (this.activePatient.treatmentPlans || []).some(tp => tp.toothNum === toothNum && tp.condition === toothData.condition);
                if (!planExists) {
                    if (!this.activePatient.treatmentPlans) this.activePatient.treatmentPlans = [];
                    const cond = TOOTH_CONDITIONS[toothData.condition];
                    const shortLabel = cond ? this.t(cond.labelAr, cond.labelEn) : toothData.condition;
                    const newPlan = {
                        id: 'tp_' + Date.now() + '_' + toothNum,
                        toothNum: toothNum,
                        condition: toothData.condition,
                        procedure: `${shortLabel} (${this.t('سن', 'Tooth')} ${toothNum})`,
                        surfaces: toothData.surfaces || [],
                        cost: toothData.cost || 0,
                        notes: toothData.notes || '',
                        date: toothData.date || '',
                        status: wantedStatus,
                        ...(wantedStatus === 'completed' ? { completedDate: this.todayISO() } : {}),
                        createdAt: new Date().toISOString()
                    };
                    this.activePatient.treatmentPlans.push(newPlan);
                    this.addVisitForPlan(newPlan, toothData.date);
                } else {
                    // Re-saving a procedure that exists: its session date follows this window.
                    const same = (this.activePatient.treatmentPlans || []).filter(tp => tp.toothNum === toothNum && tp.condition === toothData.condition)
                        .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
                    const plan = same[same.length - 1];
                    if (plan) {
                        if ((plan.status === 'completed') !== (wantedStatus === 'completed')) {
                            if (wantedStatus === 'completed') plan.completedDate = this.todayISO(); else delete plan.completedDate;
                            plan.status = wantedStatus;
                        }
                        if (toothData.date) {
                            plan.date = toothData.date;
                            (this.activePatient.visits || []).filter(v => v.planId === plan.id).forEach(v => { v.date = toothData.date; });
                        }
                    }
                }
            }
        } else {
            delete this.activePatient.teethRecord[toothNum];
        }

        await window.db.put('patients', this.activePatient);
        this.renderTreatmentPlans();
        // Keep the chart's own tooltip history in sync with the plan we just
        // added, and re-render: the chart already drew itself with the old
        // history just before this callback ran, so without a fresh render
        // the tooltip would show one diagnosis behind.
        if (this.chartManager) {
            this.chartManager.treatmentPlans = this.activePatient.treatmentPlans || [];
            this.chartManager.render();
        }
    }

    // One bridge = one treatment-plan entry covering all its teeth (one price,
    // one invoice line), kept in sync with the linked teeth on the chart.
    async handleBridgeUpdate(info) {
        if (!this.activePatient) return;
        if (!this.activePatient.teethRecord) this.activePatient.teethRecord = this.chartManager.patientTeeth;
        if (!this.activePatient.treatmentPlans) this.activePatient.treatmentPlans = [];
        const plans = this.activePatient.treatmentPlans;
        const existing = plans.find(tp => tp.bridgeId === info.bridgeId);

        if (info.removed) {
            this.activePatient.treatmentPlans = plans.filter(tp => tp.bridgeId !== info.bridgeId);
        } else {
            const cond = TOOTH_CONDITIONS[info.condition];
            const label = cond ? this.t(cond.labelAr, cond.labelEn) : info.condition;
            const span = `${info.teeth[0]}–${info.teeth[info.teeth.length - 1]}`;
            const entry = {
                id: existing ? existing.id : 'tp_' + Date.now() + '_br',
                bridgeId: info.bridgeId,
                toothNum: info.pontics[0],
                teeth: info.teeth,
                condition: info.condition,
                procedure: `${label} ${span} (${this.t('وسيط', 'pontic')}: ${info.pontics.join(', ')})`,
                surfaces: [],
                cost: info.cost || 0,
                date: info.sessionDate || '',
                status: existing ? existing.status : 'in_progress',
                createdAt: existing ? existing.createdAt : new Date().toISOString()
            };
            if (existing) plans[plans.indexOf(existing)] = entry;
            else { plans.push(entry); this.addVisitForPlan(entry, info.sessionDate); }
        }

        this.activePatient.teethRecord = this.chartManager.patientTeeth;
        await window.db.put('patients', this.activePatient);
        this.renderTreatmentPlans();
        this.chartManager.treatmentPlans = this.activePatient.treatmentPlans || [];
        this.chartManager.render();
    }

    renderTreatmentPlans() {
        const tbody = document.getElementById('treatmentPlanTableBody');
        if (!tbody || !this.activePatient) return;
        this.scheduleWorkspaceRefresh();
        this.renderVisitsLog(); // pending plans are listed there too

        const plans = this.activePatient.treatmentPlans || [];
        if (plans.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">${this.t('لا توجد خطط علاجية. انقر على أي سن في المخطط لتسجيل الإجراء أو أضف إجراءً مخصصاً.', 'No treatment plans yet. Click any tooth on the chart to record a procedure, or add a custom procedure.')}</td></tr>`;
            return;
        }

        tbody.innerHTML = plans.map(plan => `
            <tr>
                <td><strong>${plan.teeth ? this.t('الأسنان', 'Teeth') + ' ' + plan.teeth[0] + '–' + plan.teeth[plan.teeth.length - 1] : (plan.toothNum ? this.t('سن', 'Tooth') + ' ' + plan.toothNum : this.t('فم كامل / عام', 'Full mouth / General'))}</strong></td>
                <td${plan.toothNum ? ` style="cursor:pointer;" title="${this.t('فتح السن لإضافة ملاحظة', 'Open the tooth to add a note')}" onclick="window.app.openToothForPlan('${plan.id}')"` : ''}>${this.escapeHTML(plan.procedure)}${plan.notes ? `<br><small style="color:var(--text-muted);">${this.escapeHTML(plan.notes)}</small>` : ''}</td>
                <td>${plan.surfaces && plan.surfaces.length > 0 ? plan.surfaces.join(', ') : '--'}</td>
                <td style="font-size:0.9rem;">${(() => { const ns = this.getNotesForPlan(plan); return ns.length ? this.notesLinesHTML(ns) : '--'; })()}</td>
                <td><strong>$${(parseFloat(plan.cost) || 0).toFixed(2)}</strong></td>
                <td>
                    <select data-no-translate onchange="window.app.setPlanStatus('${plan.id}', this.value)" style="padding:6px 10px; font-weight:700; border-radius:8px; min-width:130px; ${plan.status === 'completed' ? 'color:#047857; background:#d1fae5;' : ''}">
                        <option value="in_progress" ${plan.status !== 'completed' ? 'selected' : ''}>In Progress</option>
                        <option value="completed" ${plan.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </td>
                <td>
                    ${plan.teeth || plan.bridgeId ? '' : `<button class="btn btn-secondary btn-sm" title="${this.t('تغيير رقم السن', 'Change tooth')}" onclick="window.app.changePlanTooth('${plan.id}')">✏️</button>`}
                    <button class="btn btn-danger btn-sm" onclick="window.app.deleteTreatmentPlan('${plan.id}')">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    // Records the clinical session that goes with a plan the moment work on
    // it begins.
    addVisitForPlan(plan, sessionDate) {
        if (!this.activePatient.visits) this.activePatient.visits = [];
        this.activePatient.visits.unshift({
            id: 'vis_plan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            planId: plan.id,
            date: sessionDate || plan.date || this.todayISO(),
            toothNum: plan.toothNum || null,
            toothCondition: plan.toothNum ? this.getToothConditionLabel(plan.toothNum) : '',
            chiefComplaint: '--',
            procedureDone: plan.procedure,
            doctorNotes: plan.notes || '--',
            source: 'treatment_plan',
            createdBy: this.activeStaff?.name || null,
            createdAt: new Date().toISOString()
        });
    }

    // Plans saved by earlier versions as "planned" are treated as in progress:
    // they get their session now, once.
    async migratePlannedPlans() {
        const plans = (this.activePatient?.treatmentPlans || []).filter(p => p.status === 'planned');
        if (plans.length === 0) return;
        plans.forEach(p => { p.status = 'in_progress'; this.addVisitForPlan(p); });
        await window.db.put('patients', this.activePatient);
    }

    async completePlan(planId, done = true) {
        await this.updatePlanStatus(planId, done ? 'completed' : 'in_progress');
        this.renderTreatmentPlans();
    }

    async setPlanStatus(planId, status) {
        await this.updatePlanStatus(planId, status === 'completed' ? 'completed' : 'in_progress');
        this.renderTreatmentPlans();
        if (this.chartManager) { this.chartManager.treatmentPlans = this.activePatient.treatmentPlans || []; this.chartManager.render(); }
    }

    async updatePlanStatus(planId, newStatus) {
        if (!this.activePatient) return;
        const plan = (this.activePatient.treatmentPlans || []).find(p => p.id === planId);
        if (plan) {
            const wasActive = plan.status === 'in_progress' || plan.status === 'completed';
            // Reports show the start date while in progress, and the day it was marked Completed afterwards.
            if (newStatus === 'completed' && plan.status !== 'completed') plan.completedDate = this.todayISO();
            else if (newStatus !== 'completed') delete plan.completedDate;
            plan.status = newStatus;

            // The plan only becomes a clinical session once work actually
            // starts ("In Progress") — not while it's merely "Planned".
            if ((newStatus === 'in_progress' || newStatus === 'completed') && !wasActive) {
                if (!this.activePatient.visits) this.activePatient.visits = [];
                this.activePatient.visits.unshift({
                    id: 'vis_plan_' + Date.now(),
                    date: this.todayISO(),
                    toothNum: plan.toothNum || null,
                    toothCondition: plan.toothNum ? this.getToothConditionLabel(plan.toothNum) : '',
                    chiefComplaint: '--',
                    procedureDone: plan.procedure,
                    doctorNotes: '--',
                    source: 'treatment_plan',
                    createdBy: this.activeStaff?.name || null,
                    createdAt: new Date().toISOString()
                });
                this.renderVisitsLog();
            }

            await window.db.put('patients', this.activePatient);
            this.showToast(this.t('تم تحديث حالة الخطة العلاجية.', 'Treatment plan status updated.'), 'info');
        }
    }

    // A procedure lives in several places (treatment plan, its clinical
    // session, the tooth on the chart, the invoice pre-fill, the Overview
    // count). Removing it from one removes it from all of them.
    removePlanEverywhere(plan) {
        const patient = this.activePatient;
        const isLinkedVisit = v => v.planId === plan.id || (!v.planId && v.source === 'treatment_plan' && v.procedureDone === plan.procedure);
        patient.visits = (patient.visits || []).filter(v => !isLinkedVisit(v));
        patient.treatmentPlans = (patient.treatmentPlans || []).filter(p => p.id !== plan.id);

        if (this.chartManager) {
            if (plan.bridgeId) {
                this.chartManager.dissolveBridge(plan.bridgeId);
            } else if (plan.toothNum && patient.teethRecord && patient.teethRecord[plan.toothNum]?.condition === plan.condition) {
                const stillUsed = patient.treatmentPlans.some(p => p.toothNum === plan.toothNum && p.condition === plan.condition);
                if (!stillUsed) delete patient.teethRecord[plan.toothNum];
            }
            this.chartManager.patientTeeth = patient.teethRecord || {};
            this.chartManager.treatmentPlans = patient.treatmentPlans;
            this.chartManager.render();
        }
    }

    // Fixes a procedure entered on the wrong tooth: the plan, its session(s),
    // chart record and notes all follow it to the new tooth.
    async changePlanTooth(planId) {
        const p = this.activePatient;
        const plan = p && (p.treatmentPlans || []).find(x => x.id === planId);
        if (!plan) return;
        const oldTooth = plan.toothNum ? Number(plan.toothNum) : null;
        const answer = prompt(this.t('أدخل رقم السن الصحيح لهذا الإجراء:', 'Enter the correct tooth number for this procedure:'), oldTooth || '');
        if (answer === null) return;
        const newTooth = Number(String(answer).trim());
        if (!/^(1[1-8]|2[1-8]|3[1-8]|4[1-8]|5[1-5]|6[1-5]|7[1-5]|8[1-5])$/.test(String(newTooth))) {
            this.showToast(this.t('رقم سن غير صالح.', 'Invalid tooth number.'), 'warning');
            return;
        }
        if (newTooth === oldTooth) return;
        const linked = (p.visits || []).filter(v => v.planId === plan.id || (!v.planId && v.source === 'treatment_plan' && v.procedureDone === plan.procedure));
        const visitTextBefore = linked.map(v => ({ v, same: v.procedureDone === plan.procedure }));
        this.moveVisitPlanToTooth({ planId: plan.id }, oldTooth, newTooth);
        visitTextBefore.forEach(({ v, same }) => {
            v.planId = plan.id;
            v.toothNum = newTooth;
            v.toothCondition = this.getToothConditionLabel(newTooth);
            v.procedureDone = same ? plan.procedure : this.retagToothText(v.procedureDone, oldTooth, newTooth);
        });
        await window.db.put('patients', p);
        this.renderTreatmentPlans();
        await this.loadPatientInvoices();
        this.showToast(this.t(`تم نقل الإجراء إلى السن ${newTooth}.`, `Procedure moved to tooth ${newTooth}.`), 'success');
    }

    async deleteTreatmentPlan(planId) {
        if (!this.activePatient) return;
        const plan = (this.activePatient.treatmentPlans || []).find(p => p.id === planId);
        if (!plan) return;
        this.removePlanEverywhere(plan);
        await window.db.put('patients', this.activePatient);
        this.renderTreatmentPlans();
        this.showToast(this.t('تم حذف الإجراء من الخطة والجلسات والمخطط.', 'Procedure removed from the plan, sessions and chart.'), 'info');
    }

    // The old stand-alone Procedure dialog is now part of the merged Procedure & Visit window.
    async openAddPlanItemModal() { return this.openNewVisitModal({ focusProcedure: true }); }

    // Looks up the matching catalog price (by the same svc_<condition> id used
    // in the recommended services catalog) so the cost field reflects
    // whatever the clinic has set — same lookup used in the tooth diagnosis
    // modal, so both places always agree.
    async lookupConditionPrice(conditionKey) {
        // Custom conditions (from "Manage Services & Prices") use the
        // service's own id directly; built-in ones are stored as svc_<key>.
        let service = await window.db.get('services', conditionKey);
        if (!service) service = await window.db.get('services', `svc_${conditionKey}`);
        // null = not in the catalog at all; a listed price of 0 is still a price.
        return service ? (parseFloat(service.price) || 0) : null;
    }

    // Type-to-filter for the tooth diagnosis condition list — same behavior
    // as the Procedure & Visit picker: as soon as a match exists, it is
    // selected so the field visibly updates on the first typed letter.
    filterToothConditionOptions(query) {
        const q = String(query || '').trim().toLowerCase();
        const select = document.getElementById('toothConditionSelect');
        if (!select) return;
        Array.from(select.children).forEach(node => {
            if (node.tagName === 'OPTION') { node.hidden = !!q && node.value !== '' && !node.textContent.toLowerCase().includes(q); return; }
            let any = false;
            node.querySelectorAll('option').forEach(o => {
                const show = !q || o.textContent.toLowerCase().includes(q) || node.label.toLowerCase().includes(q);
                o.hidden = !show;
                if (show) any = true;
            });
            node.hidden = !any;
        });
        if (q) {
            const firstMatch = Array.from(select.options).find(o => o.value && !o.hidden && !o.closest('optgroup[hidden]'));
            if (firstMatch && select.value !== firstMatch.value) {
                select.value = firstMatch.value;
                this.onToothConditionChanged(firstMatch.value);
                window.chartManager?.onConditionSelectChanged(firstMatch.value);
            }
        }
    }

    async onToothConditionChanged(conditionKey) {
        // Bridge cost is unit price x number of teeth; the chart manager sets it.
        const countWrap = document.getElementById('toothCountWrap');
        if (countWrap) countWrap.style.display = (isBridgeKey(conditionKey) || conditionKey === 'healthy') ? 'none' : 'flex';
        if (isBridgeKey(conditionKey) || conditionKey === 'healthy') { const c = document.getElementById('toothCountSelect'); if (c) c.value = '1'; this.toothPick = new Set(); this.renderToothPicker(); }
        if (isBridgeKey(conditionKey)) return;
        const price = await this.lookupConditionPrice(conditionKey);
        this.toothUnitPrice = price;
        document.getElementById('toothCostInput').value = price === null ? '' : +(price * this.getToothCount()).toFixed(2);
        this.renderToothPicker();
    }

    // ---- Per-tooth visit notes: details only, never touch cost / diagnosis ----
    byNoteDate(a, b) {
        return String(a.date || '').localeCompare(String(b.date || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    }

    plansOfTooth(tooth) {
        return (this.activePatient?.treatmentPlans || []).filter(p => Number(p.toothNum) === Number(tooth))
            .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    }

    // Notes belong to one procedure of the tooth. Older notes saved without a
    // procedure are shown under the tooth's latest procedure.
    getNotesForPlan(plan) {
        if (!plan || !plan.toothNum || !this.activePatient) return [];
        const plans = this.plansOfTooth(plan.toothNum), latest = plans[plans.length - 1];
        return (this.activePatient.toothNotes?.[plan.toothNum] || [])
            .filter(n => n.planId ? n.planId === plan.id : (latest && latest.id === plan.id))
            .sort((a, b) => this.byNoteDate(a, b));
    }

    getNotesForVisit(v) {
        if (!this.activePatient) return [];
        const plan = v.planId ? (this.activePatient.treatmentPlans || []).find(p => p.id === v.planId) : null;
        if (plan) return this.getNotesForPlan(plan);
        if (!v.toothNum) return [];
        return (this.activePatient.toothNotes?.[v.toothNum] || []).filter(n => !n.planId && n.date === v.date).sort((a, b) => this.byNoteDate(a, b));
    }

    notesLinesHTML(notes) {
        return notes.map(n => `<div style="white-space:pre-wrap;">• <strong>${this.formatDateAR(n.date)}</strong>: ${this.escapeHTML(n.text)}</div>`).join('');
    }

    // Opens the tooth window from a Treatment Plan row, aimed at that procedure.
    openToothForPlan(planId) {
        const plan = (this.activePatient?.treatmentPlans || []).find(p => p.id === planId);
        if (!plan || !plan.toothNum || !this.chartManager) return;
        this.pendingNotePlanId = plan.id;
        this.chartManager.openToothModal(Number(plan.toothNum));
        // Show THIS procedure in the window (condition, price, surfaces, date, notes).
        const sel = document.getElementById('toothConditionSelect');
        if (isBridgeKey(plan.condition) || !sel || ![...sel.options].some(o => o.value === plan.condition)) return;
        sel.value = plan.condition;
        this.toothUnitPrice = null;
        document.getElementById('toothCostInput').value = plan.cost || '';
        document.getElementById('toothNotesInput').value = plan.notes || '';
        if (plan.date) this.setDateInput('toothSessionDate', plan.date);        ['M', 'O', 'D', 'B', 'L'].forEach(s => { const cb = document.getElementById(`surf_${s}`); if (cb) cb.checked = (plan.surfaces || []).includes(s); });
        const countWrap = document.getElementById('toothCountWrap');
        if (countWrap) countWrap.style.display = plan.condition === 'healthy' ? 'none' : 'flex';
        this.chartManager.showBridgeSection(false);
    }

    refreshNoteViews() {
        this.renderToothNotes();
        this.renderTreatmentPlans();
        this.renderVisitNotesBlock();
        if (this.chartManager) { this.chartManager.toothNotes = this.activePatient.toothNotes; this.chartManager.render(); }
    }

    renderToothNotes(initial = false) {
        const list = document.getElementById('toothNotesList');
        const tooth = window.chartManager?.activeTooth;
        if (!list || !tooth || !this.activePatient) return;
        this.editingToothNoteId = initial ? null : this.editingToothNoteId;
        const addBtn = document.getElementById('toothNoteAddBtn');
        if (addBtn && initial) addBtn.textContent = '➕ Add';
        const plans = this.plansOfTooth(tooth);
        const planSel = document.getElementById('toothNotePlan');
        const planWrap = document.getElementById('toothNotePlanWrap');
        if (planSel) {
            const keep = initial ? (this.pendingNotePlanId || '') : planSel.value;
            planSel.innerHTML = plans.map(p => `<option value="${p.id}">${this.escapeHTML(p.procedure)}</option>`).join('');
            planSel.value = plans.some(p => p.id === keep) ? keep : (plans.length ? plans[plans.length - 1].id : '');
            if (planWrap) planWrap.style.display = plans.length > 1 ? 'flex' : 'none';
        }
        if (initial) this.pendingNotePlanId = null;
        const planName = id => (plans.find(p => p.id === id) || {}).procedure;
        const notes = [...(this.activePatient.toothNotes?.[tooth] || [])].sort((a, b) => this.byNoteDate(b, a));
        list.innerHTML = notes.length ? notes.map(n => `
            <div style="display:flex; gap:10px; align-items:flex-start; padding:6px 0; border-top:1px solid var(--border);">
                <strong style="white-space:nowrap;">${this.formatDateAR(n.date)}</strong>
                <span style="flex:1; white-space:pre-wrap;">${this.escapeHTML(n.text)}${planName(n.planId) && plans.length > 1 ? `<br><small style="color:var(--text-muted);">${this.escapeHTML(planName(n.planId))}</small>` : ''}</span>
                <button type="button" class="btn btn-outline btn-sm" onclick="window.app.editToothNote('${n.id}', ${tooth})">✏️ Edit</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="window.app.deleteToothNote('${n.id}', ${tooth})">🗑️</button>
            </div>`).join('') : `<div style="color:var(--text-muted); font-size:0.9rem;">No visit notes yet.</div>`;
    }

    // Edit loads the note into the add form; the Add button becomes Save.
    editToothNote(noteId, tooth) {
        const note = (this.activePatient?.toothNotes?.[tooth] || []).find(n => n.id === noteId);
        if (!note) return;
        this.editingToothNoteId = noteId;
        this.setDateInput('toothNoteDate', note.date);
        document.getElementById('toothNoteText').value = note.text;
        const planSel = document.getElementById('toothNotePlan');
        if (planSel && note.planId && [...planSel.options].some(o => o.value === note.planId)) planSel.value = note.planId;
        const addBtn = document.getElementById('toothNoteAddBtn');
        if (addBtn) addBtn.textContent = '💾 Save';
        document.getElementById('toothNoteText').focus();
    }

    async addToothNote() {
        const tooth = window.chartManager?.activeTooth;
        if (!tooth || !this.activePatient) return;
        const date = this.validateDateInput('toothNoteDate', true);
        if (date === null) return;
        const input = document.getElementById('toothNoteText');
        const text = input.value.trim();
        if (!text) { this.showToast(this.t('اكتب الملاحظة أولاً.', 'Write the note first.'), 'warning'); return; }
        if (!this.activePatient.toothNotes) this.activePatient.toothNotes = {};
        if (!this.activePatient.toothNotes[tooth]) this.activePatient.toothNotes[tooth] = [];
        const planId = document.getElementById('toothNotePlan')?.value || (this.plansOfTooth(tooth).slice(-1)[0]?.id) || null;
        const editing = this.editingToothNoteId ? this.activePatient.toothNotes[tooth].find(n => n.id === this.editingToothNoteId) : null;
        if (editing) {
            Object.assign(editing, { date, text, planId, updatedAt: new Date().toISOString() });
        } else {
            this.activePatient.toothNotes[tooth].push({
                id: 'tn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), date, text, planId,
                createdBy: this.activeStaff?.name || null, createdAt: new Date().toISOString()
            });
        }
        await window.db.put('patients', this.activePatient);
        input.value = '';
        this.editingToothNoteId = null;
        const addBtn = document.getElementById('toothNoteAddBtn');
        if (addBtn) addBtn.textContent = '➕ Add';
        this.refreshNoteViews();
        this.showToast(editing ? this.t('تم تعديل الملاحظة.', 'Note updated.') : this.t('تمت إضافة ملاحظة الزيارة.', 'Visit note added.'), 'success');
    }

    async deleteToothNote(noteId, tooth) {
        tooth = tooth || window.chartManager?.activeTooth;
        if (!tooth || !this.activePatient || !confirm(this.t('حذف هذه الملاحظة؟', 'Delete this note?'))) return;
        const notes = this.activePatient.toothNotes?.[tooth] || [];
        this.activePatient.toothNotes[tooth] = notes.filter(n => n.id !== noteId);
        if (!this.activePatient.toothNotes[tooth].length) delete this.activePatient.toothNotes[tooth];
        if (this.editingToothNoteId === noteId) this.editingToothNoteId = null;
        await window.db.put('patients', this.activePatient);
        this.refreshNoteViews();
    }

    // Edit from the Clinical Session window: change the note's text.
    async editToothNoteText(noteId, tooth) {
        const note = (this.activePatient?.toothNotes?.[tooth] || []).find(n => n.id === noteId);
        if (!note) return;
        const text = prompt(this.t('تعديل الملاحظة:', 'Edit note:'), note.text);
        if (text === null) return;
        if (!text.trim()) { this.showToast(this.t('الملاحظة لا يمكن أن تكون فارغة.', 'The note cannot be empty.'), 'warning'); return; }
        note.text = text.trim();
        note.updatedAt = new Date().toISOString();
        await window.db.put('patients', this.activePatient);
        this.refreshNoteViews();
    }

    // The full notes of the session being edited, with Edit / Delete.
    async addVisitToothNote() {
        const visit = this.editingVisitId ? (this.activePatient?.visits || []).find(v => v.id === this.editingVisitId) : null;
        if (!visit || !visit.toothNum) return;
        const date = this.validateDateInput('visitNoteDate', true);
        if (date === null) return;
        const input = document.getElementById('visitNoteText');
        const text = input.value.trim();
        if (!text) { this.showToast(this.t('اكتب الملاحظة أولاً.', 'Write the note first.'), 'warning'); return; }
        const tooth = visit.toothNum;
        if (!this.activePatient.toothNotes) this.activePatient.toothNotes = {};
        if (!this.activePatient.toothNotes[tooth]) this.activePatient.toothNotes[tooth] = [];
        this.activePatient.toothNotes[tooth].push({
            id: 'tn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), date, text,
            planId: visit.planId || (this.plansOfTooth(tooth).slice(-1)[0]?.id) || null,
            createdBy: this.activeStaff?.name || null, createdAt: new Date().toISOString()
        });
        await window.db.put('patients', this.activePatient);
        input.value = '';
        this.refreshNoteViews();
        this.showToast(this.t('تمت إضافة الملاحظة.', 'Note added.'), 'success');
    }

    renderVisitNotesBlock(initial = false) {
        const box = document.getElementById('visitToothNotes');
        if (!box) return;
        if (initial) { this.setDateInput('visitNoteDate', this.todayISO()); document.getElementById('visitNoteText').value = ''; }
        const visit = this.editingVisitId ? (this.activePatient?.visits || []).find(v => v.id === this.editingVisitId) : null;
        const notes = visit ? this.getNotesForVisit(visit) : [];
        const tooth = visit?.toothNum;
        box.style.display = visit && tooth ? 'block' : 'none';
        const list = document.getElementById('visitNotesList');
        if (list) list.innerHTML = notes.length ? notes.map(n => `
            <div style="display:flex; gap:10px; align-items:flex-start; padding:6px 0; border-top:1px solid var(--border);">
                <strong style="white-space:nowrap;">${this.formatDateAR(n.date)}</strong>
                <span style="flex:1; white-space:pre-wrap;">${this.escapeHTML(n.text)}</span>
                <button type="button" class="btn btn-outline btn-sm" onclick="window.app.editToothNoteText('${n.id}', ${tooth})">✏️ Edit</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="window.app.deleteToothNote('${n.id}', ${tooth})">🗑️ Delete</button>
            </div>`).join('') : '';
    }

    getToothCount() {
        return Math.min(10, Math.max(1, parseInt(document.getElementById('toothCountSelect')?.value, 10) || 1));
    }

    // The teeth the user picked (the one being edited is always included), in chart order.
    getToothCountTargets() {
        const active = Number(window.chartManager?.activeTooth);
        const pick = new Set([...(this.toothPick || []), active]);
        const order = (window.chartManager?.getDentitionArches?.(active) || []).flat();
        return order.filter(n => pick.has(n));
    }

    toggleToothPick(n) {
        n = Number(n);
        if (n === Number(window.chartManager?.activeTooth)) return;
        if (!this.toothPick) this.toothPick = new Set();
        if (this.toothPick.has(n)) this.toothPick.delete(n);
        else if (this.getToothCountTargets().length < this.getToothCount()) this.toothPick.add(n);
        else this.showToast(this.t('وصلت للعدد المحدد. أزل سناً أو زد العدد.', 'You reached the chosen number. Deselect a tooth or raise the number.'), 'info');
        this.renderToothPicker();
    }

    renderToothPicker() {
        const box = document.getElementById('toothPickerBox');
        if (!box) return;
        const count = this.getToothCount(), active = Number(window.chartManager?.activeTooth);
        const arches = window.chartManager?.getDentitionArches?.(active) || [];
        if (count <= 1 || !arches.length) { box.style.display = 'none'; box.innerHTML = ''; this.updateToothCountHint(); return; }
        const sel = new Set(this.getToothCountTargets());
        box.style.display = 'block';
        box.innerHTML = arches.map(arch => `<div class="bridge-picker" style="margin-bottom:6px;">${arch.map(n =>
            `<button type="button" class="bridge-chip ${sel.has(n) ? 'role-pontic' : ''} ${n === active ? 'is-active' : ''}" onclick="window.app.toggleToothPick(${n})">${n}</button>`).join('')}</div>`).join('');
        this.updateToothCountHint();
    }

    updateToothCountHint() {
        const hint = document.getElementById('toothCountHint');
        if (!hint) return;
        const n = this.getToothCount();
        const got = this.getToothCountTargets().length;
        hint.style.color = got !== n ? 'var(--danger)' : 'var(--text-muted)';
        hint.textContent = n === 1 ? '' : `${this.t('حدد الأسنان', 'Select teeth')}: ${got}/${n}`;
    }

    async onToothCountChanged() {
        this.toothPick = new Set();
        if (this.toothUnitPrice === null || this.toothUnitPrice === undefined) {
            this.toothUnitPrice = await this.lookupConditionPrice(document.getElementById('toothConditionSelect').value);
        }
        if (this.toothUnitPrice !== null && this.toothUnitPrice !== undefined) {
            document.getElementById('toothCostInput').value = +(this.toothUnitPrice * this.getToothCount()).toFixed(2);
        }
        this.renderToothPicker();
    }

    async openServicesCatalogModal() {
        document.getElementById('catalogServiceForm').reset();
        document.getElementById('catalogServiceId').value = '';
        await this.renderServicesCatalog();
        this.openModal('servicesCatalogModal');
    }

    async loadRecommendedServicesCatalog() {
        await window.db.syncRecommendedServicesCatalog();
        await this.renderServicesCatalog();
        await this.refreshCustomConditions();
        this.populateConditionSelects();
        this.showToast(this.t('تم تحديث كتالوج الخدمات بالقائمة الموحّدة.', 'Services catalog updated with the unified list.'), 'success');
    }

    async renderServicesCatalog() {
        const tbody = document.getElementById('servicesCatalogTableBody');
        if (!tbody) return;
        const services = await window.db.getAll('services');
        services.sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')) || String(a.name || '').localeCompare(String(b.name || '')));
        tbody.innerHTML = services.length ? services.map(service => `
            <tr>
                <td>${this.escapeHTML(service.name)}</td>
                <td>${this.escapeHTML(service.category || '--')}</td>
                <td><strong>$${(parseFloat(service.price) || 0).toFixed(2)}</strong></td>
                <td><button class="btn btn-outline btn-sm" onclick="window.app.editCatalogService('${service.id}')">✏️ ${this.t('تعديل', 'Edit')}</button>
                    <button class="btn btn-danger btn-sm" onclick="window.app.deleteCatalogService('${service.id}')">🗑️</button></td>
            </tr>`).join('') : `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">${this.t('لا توجد خدمات بعد.', 'No services yet.')}</td></tr>`;
    }

    async saveCatalogService() {
        const id = document.getElementById('catalogServiceId').value;
        const name = document.getElementById('catalogServiceName').value.trim();
        const category = document.getElementById('catalogServiceCategory').value.trim();
        const price = Number(document.getElementById('catalogServicePrice').value);
        if (!name || !Number.isFinite(price) || price < 0) {
            this.showToast(this.t('أدخل اسم خدمة وسعراً صحيحاً.', 'Enter a valid service name and price.'), 'warning');
            return;
        }
        const existing = id ? await window.db.get('services', id) : null;
        await window.db.put('services', {
            ...(existing || {}), id: id || `srv_custom_${Date.now()}`, name, category, price,
            updatedAt: new Date().toISOString()
        });
        document.getElementById('catalogServiceForm').reset();
        document.getElementById('catalogServiceId').value = '';
        await this.renderServicesCatalog();
        await this.refreshCustomConditions();
        this.populateConditionSelects();
        this.showToast(this.t('تم حفظ الخدمة في الكتالوج. أصبحت متوفرة أيضاً في قائمة Tooth Clinical Condition.', 'Service saved to the catalog. It is now also available in the Tooth Clinical Condition list.'), 'success');
    }

    async editCatalogService(id) {
        const service = await window.db.get('services', id);
        if (!service) return;
        document.getElementById('catalogServiceId').value = service.id;
        document.getElementById('catalogServiceName').value = service.name || '';
        document.getElementById('catalogServiceCategory').value = service.category || '';
        document.getElementById('catalogServicePrice').value = Number(service.price) || 0;
        document.getElementById('catalogServiceName').focus();
    }

    async deleteCatalogService(id) {
        const service = await window.db.get('services', id);
        if (!service || !confirm(this.t(`حذف خدمة «${service.name}» من الكتالوج؟`, `Delete service "${service.name}" from the catalog?`))) return;
        await window.db.delete('services', id);
        await this.renderServicesCatalog();
        await this.refreshCustomConditions();
        this.populateConditionSelects();
        this.showToast(this.t('تم حذف الخدمة من الكتالوج.', 'Service deleted from the catalog.'), 'info');
    }

    // ==========================================
    // CLINICAL ENCOUNTERS & VISITS
    // ==========================================
    renderVisitsLog() {
        const tbody = document.getElementById('visitsTableBody');
        if (!tbody || !this.activePatient) return;
        this.scheduleWorkspaceRefresh();

        const visits = [...(this.activePatient.visits || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

        if (visits.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state-row"><span class="empty-state-icon">🩺</span><span class="empty-state-text">${this.t('لا توجد زيارات مسجلة للمريض.', 'No clinical sessions recorded for this patient.')}</span></td></tr>`;
            return;
        }

        tbody.innerHTML = visits.map(v => `
            <tr>
                <td><strong>${this.formatDateAR(v.date)}</strong></td>
                <td><strong>${v.toothNum ? `${this.t('سن', 'Tooth')} ${v.toothNum}` : this.t('عام', 'General')}</strong></td>
                <td><strong>${this.escapeHTML(v.procedureDone || '--')}</strong></td>
                <td>${this.escapeHTML(v.doctorNotes || '--')}${(() => { const ns = this.getNotesForVisit(v); return ns.length ? `<div style="margin-top:6px; padding-top:6px; border-top:1px dashed var(--border); font-size:0.9rem;">${this.notesLinesHTML(ns)}</div>` : ''; })()}</td>
                <td>${v.nextVisitDate ? `📅 ${this.formatDateAR(v.nextVisitDate)}${v.nextVisitTime ? ` - ${v.nextVisitTime}` : ''}` : '--'}</td>
                <td>
                    ${(v.attachmentId || v.attachment) ? `<button class="btn btn-outline btn-sm" onclick="window.app.previewAttachment('${v.attachmentId || v.attachment}')">🖼️ ${this.t('صورة الأشعة', 'X-Ray Image')}</button>` : '--'}
                </td>
                <td>
                    ${this.buildRowActionsMenu([
                        { icon: '✏️', label: this.t('تعديل', 'Edit'), onclick: `window.app.openEditVisitModal('${v.id}')` },
                        { icon: '🗑️', label: this.t('حذف', 'Delete'), onclick: `window.app.deleteVisit('${v.id}')`, danger: true }
                    ])}
                </td>
            </tr>
        `).join('');
    }

    // Timestamps are stored in UTC ("...Z"); show them as the clinic's local
    // calendar day so late-evening entries don't land on the wrong date.
    localDateOf(value) {
        const raw = String(value || '');
        if (/T.*(Z|[+-]\d\d:?\d\d)$/.test(raw)) {
            const d = new Date(raw);
            return isNaN(d) ? '' : this.dateToISO(d);
        }
        return this.normalizeStoredDate(raw);
    }

    // Today's (or, failing that, the nearest upcoming) live appointment for a
    // patient — it carries the reason they came in.
    async getCurrentAppointment(patientId) {
        const today = this.todayISO();
        const appts = (await window.db.getAll('appointments'))
            .filter(a => a.patientId === patientId && a.status !== 'cancelled' && this.normalizeStoredDate(a.date) === today);
        return appts.find(a => a.status === 'arrived') || appts.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))[0] || null;
    }

    // The plan the doctor is working on right now: newest "in progress",
    // otherwise the newest "planned" one.
    getWorkingPlan() {
        const plans = [...(this.activePatient?.treatmentPlans || [])].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        return plans.find(p => p.status === 'in_progress') || plans.find(p => p.status === 'planned') || null;
    }

    // Every tooth of the mouth (permanent + primary) for the tooth picker, so a
    // procedure can be recorded for any tooth, not only ones already charted.
    buildToothOptionsHTML(defaultLabel) {
        const groups = [
            [this.t('الأسنان الدائمة', 'Permanent teeth'), [11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48]],
            [this.t('الأسنان اللبنية', 'Primary teeth'), [51, 52, 53, 54, 55, 61, 62, 63, 64, 65, 71, 72, 73, 74, 75, 81, 82, 83, 84, 85]]
        ];
        const fallback = defaultLabel || this.t('جلسة عامة / لا يوجد سن محدد', 'General session / no specific tooth');
        return `<option value="">${fallback}</option>` +
            groups.map(([label, teeth]) => `<optgroup label="${label}">${teeth.map(n => `<option value="${n}">${this.t('سن', 'Tooth')} ${n}</option>`).join('')}</optgroup>`).join('');
    }

    // The procedure picker of the merged "Procedure & Visit" window: the same
    // price-list taxonomy as everywhere else, minus bridges (multi-tooth,
    // done from the chart) and plain "healthy".
    populateVisitProcedureOptions() {
        const select = document.getElementById('visitProcCondition');
        if (!select) return;
        select.innerHTML = `<option value="">${this.t('— بدون إجراء محاسَب (تسجيل زيارة فقط) —', '— No billable procedure (visit note only) —')}</option>` + buildConditionOptionsHTML(false);
        select.querySelector('option[value="healthy"]')?.remove();
        select.querySelectorAll('option').forEach(o => { if (isBridgeKey(o.value)) o.remove(); });
        select.querySelectorAll('optgroup').forEach(g => { if (!g.querySelector('option')) g.remove(); });
    }

    // Type-to-filter for the procedure list.
    filterVisitProcOptions(query) {
        const q = String(query || '').trim().toLowerCase();
        const select = document.getElementById('visitProcCondition');
        Array.from(select.children).forEach(node => {
            if (node.tagName === 'OPTION') { node.hidden = !!q && node.value !== '' && !node.textContent.toLowerCase().includes(q); return; }
            let any = false;
            node.querySelectorAll('option').forEach(o => {
                const show = !q || o.textContent.toLowerCase().includes(q) || node.label.toLowerCase().includes(q);
                o.hidden = !show;
                if (show) any = true;
            });
            node.hidden = !any;
        });
        if (q) {
            const firstMatch = Array.from(select.options).find(o => o.value && !o.hidden && !o.closest('optgroup[hidden]'));
            if (firstMatch) { select.value = firstMatch.value; this.onVisitProcChanged(firstMatch.value); }
        }
    }

    getVisitXrayCount() {
        return document.getElementById('visitProcCondition')?.value === 'xray'
            ? Math.min(10, Math.max(1, parseInt(document.getElementById('visitXrayCount')?.value, 10) || 1)) : 1;
    }

    onVisitXrayCountChanged() {
        if (this.visitUnitPrice === null || this.visitUnitPrice === undefined) return;
        document.getElementById('visitProcCost').value = +(this.visitUnitPrice * this.getVisitXrayCount()).toFixed(2);
    }

    async onVisitProcChanged(conditionKey) {
        const costInput = document.getElementById('visitProcCost');
        const xrayWrap = document.getElementById('visitXrayCountWrap');
        const isXray = conditionKey === 'xray';
        if (xrayWrap) xrayWrap.style.display = isXray ? 'block' : 'none';
        if (!isXray) { const c = document.getElementById('visitXrayCount'); if (c) c.value = '1'; }
        if (!conditionKey) { this.visitUnitPrice = null; costInput.value = ''; return; }
        const price = await this.lookupConditionPrice(conditionKey);
        this.visitUnitPrice = price;
        costInput.value = price === null ? '' : +(price * this.getVisitXrayCount()).toFixed(2);
        // Fill the "procedure done" text with the procedure name when empty.
        const procInput = document.getElementById('visitProcedure');
        const cond = TOOTH_CONDITIONS[conditionKey];
        if (cond && !procInput.dataset.userEdited) procInput.value = this.t(cond.labelAr, cond.labelEn);
    }

    async openNewVisitModal(options = {}) {
        this.editingVisitId = null;
        document.getElementById('visitForm').reset();
        document.getElementById('visitModalTitle').textContent = this.t('🩺 إجراء وزيارة', '🩺 Procedure & Visit');
        document.getElementById('visitSubmitBtn').textContent = this.t('💾 حفظ', '💾 Save');
        const existingNote = document.getElementById('visitAttachmentExisting');
        if (existingNote) existingNote.style.display = 'none';
        document.getElementById('visitProcSection').style.display = 'block';
        document.getElementById('visitSaveInvoiceBtn').style.display = '';
        document.getElementById('visitProcedure').dataset.userEdited = '';
        this.populateVisitProcedureOptions();
        document.getElementById('visitProcSearch').value = '';
        document.getElementById('visitProcCost').value = '';
        this.visitUnitPrice = null;
        document.getElementById('visitXrayCountWrap').style.display = 'none';
        document.getElementById('visitXrayCount').value = '1';

        this.setDateInput('visitDate', this.todayISO());
        const appt = this.activePatient ? await this.getCurrentAppointment(this.activePatient.id) : null;
        const toothSelect = document.getElementById('visitToothNum');
        if (toothSelect) toothSelect.innerHTML = this.buildToothOptionsHTML();
        const toothSearch0 = document.getElementById('visitToothSearch');
        if (toothSearch0) toothSearch0.value = '';

        // The reason for the visit comes from today's appointment.
        if (appt?.procedure) document.getElementById('visitChiefComplaint').value = appt.procedure;

        this.refreshVisitToothStatus();
        this.renderVisitNotesBlock();
        this.openModal('visitModal');
        if (options.focusProcedure) setTimeout(() => document.getElementById('visitProcSearch').focus(), 80);
    }

    openEditVisitModal(visitId) {
        if (!this.activePatient) return;
        const visit = (this.activePatient.visits || []).find(v => v.id === visitId);
        if (!visit) return;
        this.editingVisitId = visitId;

        document.getElementById('visitForm').reset();
        document.getElementById('visitModalTitle').textContent = this.t('✏️ تعديل الجلسة السريرية', '✏️ Edit Clinical Session');
        document.getElementById('visitSubmitBtn').textContent = this.t('💾 حفظ التعديلات', '💾 Save Changes');
        // A recorded procedure is changed from the treatment plan, not here.
        document.getElementById('visitProcSection').style.display = 'none';
        document.getElementById('visitSaveInvoiceBtn').style.display = 'none';

        const toothSelect = document.getElementById('visitToothNum');
        if (toothSelect) {
            toothSelect.innerHTML = this.buildToothOptionsHTML();
            toothSelect.value = visit.toothNum || '';
        }
        const toothSearch1 = document.getElementById('visitToothSearch');
        if (toothSearch1) toothSearch1.value = '';

        this.setDateInput('visitDate', visit.date || '');
        document.getElementById('visitChiefComplaint').value = (visit.chiefComplaint && visit.chiefComplaint !== '--') ? visit.chiefComplaint : '';
        document.getElementById('visitProcedure').value = visit.procedureDone || '';
        document.getElementById('visitDoctorNotes').value = (visit.doctorNotes && visit.doctorNotes !== '--') ? visit.doctorNotes : '';
        this.setDateInput('visitNextDate', visit.nextVisitDate || '');
        document.getElementById('visitNextTime').value = visit.nextVisitTime || '';
        const reminderCheck = document.getElementById('visitNextReminderCheck');
        if (reminderCheck) {
            reminderCheck.checked = false;
            if (visit.linkedAppointmentId) {
                window.db.get('appointments', visit.linkedAppointmentId).then(appt => {
                    if (appt) reminderCheck.checked = !!appt.reminderEnabled;
                });
            }
        }

        const existingNote = document.getElementById('visitAttachmentExisting');
        if (existingNote) {
            if (visit.attachmentId || visit.attachment) {
                existingNote.textContent = this.t(
                    'يوجد صورة أشعة مرفقة حالياً. اختر ملفاً جديداً لاستبدالها، أو اتركه فارغاً للاحتفاظ بالصورة الحالية.',
                    'An X-ray image is already attached. Choose a new file to replace it, or leave this empty to keep the current image.'
                );
                existingNote.style.display = 'block';
            } else {
                existingNote.style.display = 'none';
            }
        }

        this.refreshVisitToothStatus();
        this.renderVisitNotesBlock(true);
        this.openModal('visitModal');
    }

    async deleteVisit(visitId) {
        if (!this.activePatient) return;
        const visit = (this.activePatient.visits || []).find(v => v.id === visitId);
        if (!visit) return;
        if (!confirm(this.t('هل أنت متأكد من حذف هذه الجلسة السريرية؟ لا يمكن التراجع عن هذه الخطوة.', 'Are you sure you want to delete this clinical session? This cannot be undone.'))) return;

        if (visit.attachmentId) {
            await window.db.delete('attachments', visit.attachmentId).catch(() => {});
        }
        this.activePatient.visits = (this.activePatient.visits || []).filter(v => v.id !== visitId);
        // A session created from a procedure takes that procedure with it.
        const linkedPlan = (this.activePatient.treatmentPlans || []).find(p =>
            visit.planId ? p.id === visit.planId : (visit.source === 'treatment_plan' && p.procedure === visit.procedureDone));
        if (linkedPlan) this.removePlanEverywhere(linkedPlan);
        await window.db.put('patients', this.activePatient);
        this.renderVisitsLog();
        this.renderTreatmentPlans();
        this.showToast(this.t('تم حذف الجلسة السريرية.', 'Clinical session deleted.'), 'info');
    }

    // "Filling (Tooth 36)" -> "Filling (Tooth 26)"; to no tooth -> "Filling".
    retagToothText(text, oldTooth, newTooth) {
        if (!oldTooth) return text;
        const re = new RegExp(`\\s*\\((Tooth|سن)\\s*${oldTooth}\\)`, 'g');
        return String(text || '').replace(re, (m, word) => newTooth ? ` (${word} ${newTooth})` : '').trim();
    }

    moveVisitPlanToTooth(visit, oldTooth, newTooth) {
        const p = this.activePatient;
        const plan = visit.planId ? (p.treatmentPlans || []).find(x => x.id === visit.planId) : null;
        if (!plan) return;
        plan.toothNum = newTooth;
        plan.procedure = oldTooth ? this.retagToothText(plan.procedure, oldTooth, newTooth)
            : (newTooth ? `${plan.procedure} (${this.t('سن', 'Tooth')} ${newTooth})` : plan.procedure);
        // Chart record: follow the procedure to the new tooth (never over another tooth's own diagnosis).
        if (p.teethRecord && oldTooth && p.teethRecord[oldTooth] && p.teethRecord[oldTooth].condition === plan.condition && !p.teethRecord[oldTooth].bridgeId) {
            const target = newTooth ? p.teethRecord[newTooth] : null;
            if (newTooth && (!target || target.condition === 'healthy')) p.teethRecord[newTooth] = p.teethRecord[oldTooth];
            const stillUsed = (p.treatmentPlans || []).some(x => x.id !== plan.id && Number(x.toothNum) === oldTooth && x.condition === plan.condition);
            if (!stillUsed && (!newTooth || !target || target.condition === 'healthy')) delete p.teethRecord[oldTooth];
            else if (stillUsed && newTooth && (!target || target.condition === 'healthy')) p.teethRecord[newTooth] = { ...p.teethRecord[oldTooth] };
        }
        // Notes written for this procedure move along.
        if (p.toothNotes && oldTooth && p.toothNotes[oldTooth]) {
            const moving = p.toothNotes[oldTooth].filter(n => n.planId === plan.id);
            if (moving.length) {
                p.toothNotes[oldTooth] = p.toothNotes[oldTooth].filter(n => n.planId !== plan.id);
                if (!p.toothNotes[oldTooth].length) delete p.toothNotes[oldTooth];
                if (newTooth) { (p.toothNotes[newTooth] = p.toothNotes[newTooth] || []).push(...moving); }
            }
        }
        if (this.chartManager) {
            this.chartManager.patientTeeth = p.teethRecord || {};
            this.chartManager.treatmentPlans = p.treatmentPlans || [];
            this.chartManager.toothNotes = p.toothNotes || {};
            this.chartManager.render();
        }
    }

    async saveVisit(options = {}) {
        if (!this.activePatient) return;
        const thenInvoice = options && options.thenInvoice === true;
        if (thenInvoice && !document.getElementById('visitProcCondition')?.value) {
            this.showToast(this.t('اختر إجراءً محاسَباً أولاً لإنشاء فاتورة.', 'Choose a billable procedure first to create an invoice.'), 'warning');
            return;
        }
        const date = this.validateDateInput('visitDate', true);
        if (date === null) return;
        const chiefComplaint = document.getElementById('visitChiefComplaint').value.trim();
        const procedureDone = document.getElementById('visitProcedure').value.trim();
        const doctorNotes = document.getElementById('visitDoctorNotes').value.trim();
        const toothNumRaw = document.getElementById('visitToothNum')?.value || '';
        const toothNum = toothNumRaw ? parseInt(toothNumRaw, 10) : null;
        const toothCondition = toothNum ? this.getToothConditionLabel(toothNum, this.t('غير مسجل', 'Not recorded')) : '';
        const nextVisitDate = this.validateDateInput('visitNextDate', false);
        if (nextVisitDate === null) return;
        const nextVisitTime = document.getElementById('visitNextTime')?.value || '';
        const fileInput = document.getElementById('visitAttachmentFile');

        if (nextVisitDate && !nextVisitTime) {
            this.showToast(this.t('يرجى تحديد وقت الموعد القادم أيضاً.', 'Please also set the time for the next appointment.'), 'warning');
            return;
        }
        if (!this.activePatient.visits) this.activePatient.visits = [];
        const isEditing = !!this.editingVisitId;
        const existingVisit = isEditing ? this.activePatient.visits.find(v => v.id === this.editingVisitId) : null;
        const linkedAppointmentId = existingVisit ? (existingVisit.linkedAppointmentId || null) : null;

        if (nextVisitDate && nextVisitTime) {
            const appointments = await window.db.getAll('appointments');
            // Exclude the appointment already linked to this visit — editing a
            // session and keeping its own follow-up time isn't a conflict.
            const conflict = this.findApptConflict(nextVisitDate, this.timeToMinutes(nextVisitTime), 30, appointments, linkedAppointmentId);
            if (conflict) {
                this.showToast(this.t(`لا يمكن الحجز: يوجد موعد آخر بتاريخ ${this.formatDateAR(nextVisitDate)} الساعة ${nextVisitTime}.`, `Cannot book: another appointment already exists on ${this.formatDateAR(nextVisitDate)} at ${nextVisitTime}.`), 'warning');
                return;
            }
        }

        // Keep the existing attachment unless a new file was chosen; only then
        // do we swap it and remove the old Blob so nothing orphaned piles up.
        let attachmentId = existingVisit ? (existingVisit.attachmentId || null) : null;
        if (fileInput.files && fileInput.files[0]) {
            const oldAttachmentId = attachmentId;
            attachmentId = 'att_' + Date.now();
            await window.db.saveAttachment(attachmentId, this.activePatient.id, fileInput.files[0]);
            if (oldAttachmentId) await window.db.delete('attachments', oldAttachmentId).catch(() => {});
        }

        // Keep the visit's next-follow-up date/time in sync with the
        // Appointments list: create the linked appointment the first time a
        // follow-up is set, update the same one on later edits (never a
        // duplicate), and leave it untouched if the follow-up is cleared.
        const nextReminderEnabled = !!document.getElementById('visitNextReminderCheck')?.checked;
        const syncLinkedAppointment = async () => {
            if (!nextVisitDate || !nextVisitTime) return linkedAppointmentId;
            const apptId = linkedAppointmentId || ('apt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
            const existingAppt = linkedAppointmentId ? await window.db.get('appointments', linkedAppointmentId) : null;
            await window.db.put('appointments', {
                ...(existingAppt || {}),
                id: apptId,
                patientId: this.activePatient.id,
                date: nextVisitDate,
                time: nextVisitTime,
                procedure: procedureDone ? `${this.t('متابعة بعد الجلسة', 'Follow-up after session')}: ${procedureDone}` : this.t('متابعة بعد الجلسة', 'Follow-up after session'),
                notes: this.t(`تم إنشاء الموعد تلقائياً من سجل الجلسة السريرية${toothNum ? ` - سن ${toothNum}` : ''}.`, `Appointment created automatically from the clinical session record${toothNum ? ` - Tooth ${toothNum}` : ''}.`),
                status: existingAppt?.status || 'confirmed',
                reminderEnabled: nextReminderEnabled,
                createdAt: existingAppt?.createdAt || new Date().toISOString()
            });
            return apptId;
        };

        if (isEditing && existingVisit) {
            // Moving the session to another tooth moves everything tied to it
            // (the procedure's tooth number and name, the chart record, its notes).
            const oldTooth = existingVisit.toothNum ? Number(existingVisit.toothNum) : null;
            const newTooth = toothNum ? Number(toothNum) : null;
            let procedureText = procedureDone;
            if (oldTooth !== newTooth) {
                const linkedPlan = existingVisit.planId ? (this.activePatient.treatmentPlans || []).find(x => x.id === existingVisit.planId) : null;
                const planTextBefore = linkedPlan ? linkedPlan.procedure : null;
                procedureText = this.retagToothText(procedureDone, oldTooth, newTooth);
                this.moveVisitPlanToTooth(existingVisit, oldTooth, newTooth);
                // The session text that was just the procedure's name follows the procedure.
                if (linkedPlan && procedureDone === planTextBefore) procedureText = linkedPlan.procedure;
            }
            existingVisit.date = date;
            // The session date also dates the procedure and its tooth record (what the tooth window shows).
            const datedPlan = existingVisit.planId ? (this.activePatient.treatmentPlans || []).find(x => x.id === existingVisit.planId) : null;
            if (datedPlan) {
                datedPlan.date = date;
                const rec = this.activePatient.teethRecord?.[datedPlan.toothNum];
                if (rec && rec.condition === datedPlan.condition) rec.date = date;
            }
            existingVisit.toothNum = toothNum;
            existingVisit.toothCondition = toothCondition;
            existingVisit.chiefComplaint = chiefComplaint;
            existingVisit.procedureDone = procedureText;
            existingVisit.doctorNotes = doctorNotes;
            existingVisit.nextVisitDate = nextVisitDate;
            existingVisit.nextVisitTime = nextVisitTime;
            existingVisit.attachmentId = attachmentId;
            existingVisit.linkedAppointmentId = await syncLinkedAppointment();
            existingVisit.updatedBy = this.activeStaff?.name || null;
            existingVisit.updatedAt = new Date().toISOString();

            if (nextVisitDate) this.jumpCalendarToDate(nextVisitDate);
            await window.db.put('patients', this.activePatient);
            this.editingVisitId = null;
            this.closeModal('visitModal');
            this.renderTreatmentPlans();
            this.renderVisitsLog();
            await this.loadAppointmentsList();
            await this.refreshDashboard();
            this.showToast(this.t('تم حفظ تعديلات الجلسة بنجاح.', 'Session changes saved successfully.'), 'success');
            return;
        }

        const newLinkedAppointmentId = await syncLinkedAppointment();
        if (nextVisitDate) this.jumpCalendarToDate(nextVisitDate);

        // A billable procedure chosen in the merged dialog becomes an in-progress
        // plan item (feeds the invoice, chart and reports) linked to this visit.
        const procKey = document.getElementById('visitProcCondition')?.value || '';
        let planId = null;
        let visitTooth = toothCondition;
        let procText = procedureDone;
        if (procKey) {
            const cond = TOOTH_CONDITIONS[procKey];
            const xrayCount = this.getVisitXrayCount();
            const procName = (cond ? this.t(cond.labelAr, cond.labelEn) : procKey) + (xrayCount > 1 ? ` ×${xrayCount}` : '');
            const cost = parseFloat(document.getElementById('visitProcCost').value) || 0;
            if (!this.activePatient.treatmentPlans) this.activePatient.treatmentPlans = [];
            if (!this.activePatient.teethRecord) this.activePatient.teethRecord = {};
            const plan = {
                id: 'tp_' + Date.now(),
                toothNum,
                condition: procKey,
                procedure: `${procName}${toothNum ? ` (${this.t('سن', 'Tooth')} ${toothNum})` : ''}`,
                surfaces: [],
                cost,
                ...(xrayCount > 1 ? { quantity: xrayCount } : {}),
                notes: doctorNotes,
                date, // the chosen session date — used by Account's "not invoiced yet" line, not today's date
                status: 'in_progress',
                createdAt: new Date().toISOString()
            };
            this.activePatient.treatmentPlans.push(plan);
            planId = plan.id;
            if (!procText) procText = procName;
            if (toothNum && !this.activePatient.teethRecord[toothNum]?.bridgeId) {
                const rec = { condition: procKey, surfaces: [], notes: doctorNotes, cost, updatedAt: new Date().toISOString() };
                this.activePatient.teethRecord[toothNum] = rec;
                if (this.chartManager?.patientTeeth && this.chartManager.patientTeeth !== this.activePatient.teethRecord) this.chartManager.patientTeeth[toothNum] = rec;
                visitTooth = this.getToothConditionLabel(toothNum, toothCondition);
            }
        }
        this.activePatient.visits.unshift({
            id: 'vis_' + Date.now(), date, toothNum, toothCondition: visitTooth, chiefComplaint, procedureDone: procText, doctorNotes,
            nextVisitDate, nextVisitTime, attachmentId, linkedAppointmentId: newLinkedAppointmentId,
            ...(planId ? { planId } : {}),
            createdBy: this.activeStaff?.name || null, createdAt: new Date().toISOString()
        });
        await window.db.put('patients', this.activePatient);
        if (planId) {
            this.renderTreatmentPlans();
            if (this.chartManager) { this.chartManager.treatmentPlans = this.activePatient.treatmentPlans; this.chartManager.render(); }
        }
        this.closeModal('visitModal');
        this.renderVisitsLog();
        await this.loadAppointmentsList();
        await this.refreshDashboard();
        this.showToast(nextVisitDate ? this.t('تم تسجيل الجلسة وحجز الموعد القادم بنجاح 📅', 'Session recorded and next appointment booked successfully 📅') : this.t('تم تسجيل الجلسة السريرية بنجاح.', 'Clinical session recorded successfully.'), 'success');
        // The new procedure is already an un-invoiced plan, so the normal
        // invoice window picks up its tooth and price by itself.
        if (thenInvoice && planId) await this.openCreateInvoiceModal();
    }

    async previewAttachment(ref) {
        let url, revoke = false;
        if (typeof ref === 'string' && ref.startsWith('data:')) {
            // Legacy visits stored the image inline as a base64 data URL —
            // only accept an actual image (a crafted value must not get through).
            if (!/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i.test(ref)) {
                this.showToast(this.t('تعذر تحميل صورة الأشعة.', 'Could not load the X-ray image.'), 'error');
                return;
            }
            url = ref;
        } else {
            const record = await window.db.getAttachment(ref);
            if (!record || !record.blob) {
                this.showToast(this.t('تعذر تحميل صورة الأشعة.', 'Could not load the X-ray image.'), 'error');
                return;
            }
            url = URL.createObjectURL(record.blob);
            revoke = true;
        }
        const win = window.open('');
        if (!win) {
            this.showToast(this.t('المتصفح منع فتح النافذة. اسمح بالنوافذ المنبثقة لهذا الموقع.', 'The browser blocked the window. Allow pop-ups for this site.'), 'warning');
            return;
        }
        // Built with DOM calls, not by writing HTML, so the URL can never break out of the tag.
        const img = win.document.createElement('img');
        img.style.cssText = 'max-width:100%; height:auto; margin:20px auto; display:block; border-radius:8px;';
        img.src = url;
        win.document.body.appendChild(img);
        if (revoke) setTimeout(() => URL.revokeObjectURL(url), 15000);
    }

    // ==========================================
    // 4. DENTAL LAB & ALIGNER TRACKER (ToothLogic)
    // ==========================================
    async loadLabCasesList() {
        const cases = await window.db.getAll('lab_cases');
        const patients = await window.db.getAll('patients');

        const tbody = document.getElementById('labCasesTableBody');
        if (!tbody) return;

        if (cases.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">${this.t('لا توجد طلبات مختبر حالية. انقر على "➕ طلب مختبر جديد".', 'No active laboratory requests. Click "➕ New Laboratory Case".')}</td></tr>`;
            return;
        }

        cases.sort((a,b) => new Date(b.sentDate) - new Date(a.sentDate));

        tbody.innerHTML = cases.map(c => {
            const pat = patients.find(p => p.id === c.patientId);
            return `
            <tr>
                <td><strong>${c.caseNumber}</strong></td>
                <td>${pat ? `<a href="javascript:void(0)" onclick="window.app.openPatientProfile('${pat.id}')" style="color:var(--primary); font-weight:700;">${this.escapeHTML(pat.name)}</a>` : this.t('غير محدد', 'Not specified')}</td>
                <td><strong>${this.escapeHTML(c.labName)}</strong></td>
                <td>${this.escapeHTML(c.workType)} ${c.shade ? `(${this.t('لون', 'shade')} ${this.escapeHTML(c.shade)})` : ''}</td>
                <td>${this.formatDateAR(c.sentDate)}</td>
                <td><strong style="color:var(--danger);">${c.dueDate ? this.formatDateAR(c.dueDate) : '--'}</strong></td>
                <td><span class="badge ${this.getLabBadgeClass(c.status)}">${this.getLabStatusLabel(c.status)}</span></td>
                <td>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <select onchange="window.app.updateLabCaseStatus('${c.id}', this.value)" style="padding:4px 8px; font-size:0.85rem; border-radius:4px;">
                            <option value="in_lab" ${c.status === 'in_lab' ? 'selected' : ''}>${this.t('في المختبر', 'In Laboratory')}</option>
                            <option value="received" ${c.status === 'received' ? 'selected' : ''}>${this.t('تم الاستلام', 'Received')}</option>
                            <option value="fitted" ${c.status === 'fitted' ? 'selected' : ''}>${this.t('تم التركيب للمريض ✅', 'Fitted for Patient ✅')}</option>
                        </select>
                        <button class="btn btn-outline btn-sm icon-btn" title="${this.t('تعديل', 'Edit')}" onclick="window.app.openEditLabCaseModal('${c.id}')">✏️</button>
                        <button class="btn btn-danger btn-sm icon-btn" title="${this.t('حذف', 'Delete')}" onclick="window.app.deleteLabCase('${c.id}')">🗑️</button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    async loadPatientLabCases() {
        if (!this.activePatient) return;
        this.scheduleWorkspaceRefresh();
        const cases = await window.db.getAll('lab_cases');
        const patCases = cases.filter(c => c.patientId === this.activePatient.id);

        const tbody = document.getElementById('patLabCasesTableBody');
        if (tbody) {
            if (patCases.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:15px; color:var(--text-muted);">${this.t('لا توجد طلبات مختبر مسجلة لهذا المريض.', 'No laboratory requests recorded for this patient.')}</td></tr>`;
            } else {
                tbody.innerHTML = patCases.map(c => `
                    <tr>
                        <td><strong>${c.caseNumber}</strong></td>
                        <td>${this.escapeHTML(c.labName)}</td>
                        <td>${this.escapeHTML(c.workType)}</td>
                        <td>${this.escapeHTML(c.shade || '--')}</td>
                        <td>${c.dueDate ? this.formatDateAR(c.dueDate) : '--'}</td>
                        <td><span class="badge ${this.getLabBadgeClass(c.status)}">${this.getLabStatusLabel(c.status)}</span></td>
                        <td>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <select onchange="window.app.updateLabCaseStatus('${c.id}', this.value)" style="padding:4px 8px; font-size:0.85rem;">
                                    <option value="in_lab" ${c.status === 'in_lab' ? 'selected' : ''}>${this.t('في المختبر', 'In Laboratory')}</option>
                                    <option value="received" ${c.status === 'received' ? 'selected' : ''}>${this.t('تم الاستلام', 'Received')}</option>
                                    <option value="fitted" ${c.status === 'fitted' ? 'selected' : ''}>${this.t('تم التركيب للمريض ✅', 'Fitted for Patient ✅')}</option>
                                </select>
                                <button class="btn btn-outline btn-sm icon-btn" title="${this.t('تعديل', 'Edit')}" onclick="window.app.openEditLabCaseModal('${c.id}')">✏️</button>
                                <button class="btn btn-danger btn-sm icon-btn" title="${this.t('حذف', 'Delete')}" onclick="window.app.deleteLabCase('${c.id}')">🗑️</button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }
    }

    async openNewLabCaseModal() {
        this.editingLabCaseId = null;
        document.getElementById('labCaseForm').reset();
        document.getElementById('labCaseModalTitle').textContent = this.t('🧪 تسجيل وإرسال طلب لمختبر الأسنان', '🧪 New Laboratory Request');
        document.getElementById('labCaseSubmitBtn').textContent = this.t('💾 حفظ وإرسال للمختبر', '💾 Save & Send to Lab');

        const patients = await window.db.getAll('patients');
        const select = document.getElementById('labPatientSelect');
        if (select) {
            select.disabled = false;
            select.innerHTML = `<option value="">${this.t('اختر المريض...', 'Select a patient...')}</option>` +
                patients.filter(p => !p.isArchived).map(p => `<option value="${p.id}">${this.escapeHTML(p.name)} (${this.escapeHTML(p.patientCode)})</option>`).join('');

            if (this.activePatient) {
                select.value = this.activePatient.id;
            }
        }

        const nextNum = await window.db.getNextLabCaseNumber();
        document.getElementById('labCaseNumberDisplay').value = nextNum;
        this.setDateInput('labSentDate', this.todayISO());

        this.openModal('newLabCaseModal');
    }

    async openEditLabCaseModal(caseId) {
        const c = await window.db.get('lab_cases', caseId);
        if (!c) return;
        this.editingLabCaseId = caseId;
        document.getElementById('labCaseModalTitle').textContent = this.t('✏️ تعديل طلب المختبر', '✏️ Edit Laboratory Request');
        document.getElementById('labCaseSubmitBtn').textContent = this.t('💾 حفظ التعديلات', '💾 Save Changes');

        const patients = await window.db.getAll('patients');
        const select = document.getElementById('labPatientSelect');
        if (select) {
            select.disabled = false;
            select.innerHTML = `<option value="">${this.t('اختر المريض...', 'Select a patient...')}</option>` +
                patients.filter(p => !p.isArchived).map(p => `<option value="${p.id}">${this.escapeHTML(p.name)} (${this.escapeHTML(p.patientCode)})</option>`).join('');
            select.value = c.patientId;
        }

        document.getElementById('labCaseNumberDisplay').value = c.caseNumber;
        document.getElementById('labNameInput').value = c.labName || '';
        document.getElementById('labWorkTypeInput').value = c.workTypeBase || c.workType || '';
        document.getElementById('labToothNumInput').value = c.toothNumber || '';
        document.getElementById('labShadeInput').value = c.shade || '';
        document.getElementById('labCostInput').value = c.cost || '';
        this.setDateInput('labSentDate', c.sentDate || '');
        this.setDateInput('labDueDate', c.dueDate || '');
        document.getElementById('labNotesInput').value = c.notes || '';

        this.openModal('newLabCaseModal');
    }

    async saveLabCase() {
        const patientId = document.getElementById('labPatientSelect').value;
        const caseNumber = document.getElementById('labCaseNumberDisplay').value;
        const labName = document.getElementById('labNameInput').value.trim();
        const workType = document.getElementById('labWorkTypeInput').value.trim();
        const toothNumber = document.getElementById('labToothNumInput').value.trim();
        const shade = document.getElementById('labShadeInput').value.trim();
        const sentDate = this.validateDateInput('labSentDate', true);
        if (sentDate === null) return;
        const dueDate = this.validateDateInput('labDueDate', false);
        if (dueDate === null) return;
        const cost = parseFloat(document.getElementById('labCostInput').value) || 0;
        const notes = document.getElementById('labNotesInput').value.trim();

        if (!patientId || !labName || !workType) {
            this.showToast(this.t('يرجى تحديد المريض واسم المختبر ونوع العمل المطلوب.', 'Please select the patient, laboratory name, and work type.'), 'warning');
            return;
        }

        const isEditing = !!this.editingLabCaseId;
        const existing = isEditing ? await window.db.get('lab_cases', this.editingLabCaseId) : null;

        const caseObj = {
            ...(existing || {}),
            id: existing ? existing.id : 'lab_' + Date.now(),
            caseNumber,
            patientId,
            labName,
            workType: toothNumber ? `${workType} (${this.t('سن', 'Tooth')} ${toothNumber})` : workType,
            workTypeBase: workType,
            toothNumber,
            shade,
            sentDate,
            dueDate,
            cost,
            notes,
            status: existing ? existing.status : 'in_lab',
            createdBy: existing ? existing.createdBy : (this.activeStaff?.name || null),
            createdAt: existing ? existing.createdAt : new Date().toISOString()
        };
        if (isEditing) {
            caseObj.updatedBy = this.activeStaff?.name || null;
            caseObj.updatedAt = new Date().toISOString();
        }

        await window.db.put('lab_cases', caseObj);
        this.editingLabCaseId = null;
        this.closeModal('newLabCaseModal');
        this.showToast(isEditing ? this.t('تم حفظ تعديلات طلب المختبر.', 'Laboratory request changes saved.') : this.t('تم تسجيل طلب المختبر بنجاح.', 'Laboratory request recorded successfully.'), 'success');
        await this.loadLabCasesList();
        await this.loadPatientLabCases();
        await this.refreshDashboard();
    }

    async deleteLabCase(caseId) {
        const c = await window.db.get('lab_cases', caseId);
        if (!c) return;
        if (!confirm(this.t(`حذف طلب المختبر ${c.caseNumber} (${c.workType || ''})؟ لا يمكن التراجع.`, `Delete laboratory request ${c.caseNumber} (${c.workType || ''})? This cannot be undone.`))) return;
        await window.db.delete('lab_cases', caseId);
        // Its due-date reminders no longer mean anything.
        const notifs = (await window.db.getAll('notifications')).filter(n => n.type === 'lab_due' && n.refId === caseId);
        for (const n of notifs) await window.db.delete('notifications', n.id);
        this.showToast(this.t('تم حذف طلب المختبر.', 'Laboratory request deleted.'), 'info');
        await this.loadLabCasesList();
        await this.loadPatientLabCases();
        await this.refreshNotificationBadge();
        await this.refreshDashboard();
    }

    async updateLabCaseStatus(caseId, status) {
        const c = await window.db.get('lab_cases', caseId);
        if (c) {
            c.status = status;
            await window.db.put('lab_cases', c);
            this.showToast(this.t('تم تحديث حالة طلب المختبر.', 'Laboratory request status updated.'), 'info');
            await this.loadLabCasesList();
            await this.loadPatientLabCases();
            await this.refreshDashboard();
        }
    }

    getLabBadgeClass(status) {
        if (status === 'received') return 'badge-cyan';
        if (status === 'fitted') return 'badge-green';
        return 'badge-amber';
    }

    getLabStatusLabel(status) {
        if (status === 'received') return this.t('تم الاستلام من المختبر', 'Received from Laboratory');
        if (status === 'fitted') return this.t('تم التركيب للمريض ✅', 'Fitted for Patient ✅');
        return this.t('في المختبر (قيد العمل)', 'In Laboratory (In Progress)');
    }

    // ==========================================
    // ORTHO TREATMENT LEDGER
    // One "Due Amount" the patient owes for the whole ortho case, paid down
    // by installments; each row shows what's left after that payment.
    // ==========================================
    async openOrthoModal() {
        if (!this.activePatient) return;
        document.getElementById('orthoDueAmountInput').value = this.activePatient.orthoDueAmount || '';
        document.getElementById('orthoEntryForm').reset();
        this.setDateInput('orthoEntryDate', this.todayISO());
        this.renderOrthoEntries();
        this.openModal('orthoModal');
    }

    async updateOrthoDueAmount(value) {
        if (!this.activePatient) return;
        this.activePatient.orthoDueAmount = parseFloat(value) || 0;
        await window.db.put('patients', this.activePatient);
        this.renderOrthoEntries();
    }

    async addOrthoEntry() {
        if (!this.activePatient) return;
        const date = this.validateDateInput('orthoEntryDate', true);
        if (date === null) return;
        const tooth = document.getElementById('orthoEntryTooth').value.trim();
        const treatment = document.getElementById('orthoEntryTreatment').value.trim();
        const paid = parseFloat(document.getElementById('orthoEntryPaid').value) || 0;
        const note = document.getElementById('orthoEntryNote').value.trim();
        if (paid <= 0 && !note) {
            this.showToast(this.t('يرجى إدخال مبلغ دفعة صحيح أو كتابة ملاحظة.', 'Please enter a valid paid amount or a note.'), 'warning');
            return;
        }
        if (!this.activePatient.orthoEntries) this.activePatient.orthoEntries = [];
        this.activePatient.orthoEntries.push({
            id: 'ortho_' + Date.now(), date, tooth, treatment, paid, note,
            createdBy: this.activeStaff?.name || null, createdAt: new Date().toISOString()
        });
        await window.db.put('patients', this.activePatient);
        document.getElementById('orthoEntryForm').reset();
        this.setDateInput('orthoEntryDate', this.todayISO());
        this.renderOrthoEntries();
        this.showToast(this.t('تمت إضافة الحركة إلى سجل التقويم.', 'Entry added to the ortho ledger.'), 'success');
    }

    async deleteOrthoEntry(entryId) {
        if (!this.activePatient) return;
        if (!confirm(this.t('حذف هذه الدفعة من سجل التقويم؟', 'Delete this payment from the ortho ledger?'))) return;
        this.activePatient.orthoEntries = (this.activePatient.orthoEntries || []).filter(e => e.id !== entryId);
        await window.db.put('patients', this.activePatient);
        this.renderOrthoEntries();
    }

    async exportOrthoLedgerToExcel() {
        if (!this.activePatient) return;
        if (typeof ExcelJS === 'undefined') {
            this.showToast(this.t('تعذر تحميل مكتبة Excel. تأكد من الاتصال بالإنترنت وحاول مجدداً.', 'Could not load the Excel library. Check your internet connection and try again.'), 'error');
            return;
        }
        const due = this.activePatient.orthoDueAmount || 0;
        const entries = this.activePatient.orthoEntries || [];
        let cumulativePaid = 0;
        const withRemaining = entries.map(e => {
            cumulativePaid += parseFloat(e.paid) || 0;
            return { ...e, remaining: due - cumulativePaid };
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(this.t('سجل التقويم', 'Ortho Ledger'));
        sheet.addRow([this.t('المريض', 'Patient'), this.activePatient.name]);
        sheet.addRow([this.t('المبلغ المطلوب', 'Due Amount'), due]);
        sheet.addRow([]);
        sheet.addRow([this.t('التاريخ', 'Date'), this.t('السن', 'Tooth'), this.t('العلاج', 'Treatment'), this.t('المدفوع', 'Paid'), this.t('ملاحظة', 'Note'), this.t('المتبقي', 'Total (Remaining)')]);
        withRemaining.forEach(e => sheet.addRow([this.formatDateAR(e.date), e.tooth || '--', e.treatment || '--', parseFloat(e.paid) || 0, e.note || '--', e.remaining]));
        sheet.columns = [{ width: 16 }, { width: 18 }, { width: 26 }, { width: 14 }, { width: 26 }, { width: 18 }];

        const headerRowIdx = 4;
        const thinBorder = { style: 'thin' };
        sheet.eachRow({ includeEmpty: false }, row => {
            row.eachCell({ includeEmpty: false }, cell => {
                cell.font = { size: 16 };
                cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            });
        });
        sheet.getRow(headerRowIdx).eachCell({ includeEmpty: false }, cell => {
            cell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF595959' } };
        });

        const dateStr = new Date().toISOString().slice(0, 10);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Ortho_Ledger_${this.activePatient.patientCode || this.activePatient.id}_${dateStr}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast(this.t('تم تصدير سجل التقويم بنجاح.', 'Ortho ledger exported successfully.'), 'success');
    }

    renderOrthoEntries() {
        const tbody = document.getElementById('orthoEntriesTableBody');
        const summaryDiv = document.getElementById('orthoSummary');
        if (!tbody || !this.activePatient) return;
        const due = this.activePatient.orthoDueAmount || 0;
        const entries = this.activePatient.orthoEntries || [];

        let cumulativePaid = 0;
        const withRemaining = entries.map(e => {
            cumulativePaid += parseFloat(e.paid) || 0;
            return { ...e, remaining: due - cumulativePaid };
        });
        const totalPaid = cumulativePaid;
        const remaining = due - totalPaid;

        if (summaryDiv) {
            summaryDiv.innerHTML = `
                <span>Due Amount: <span style="color:var(--primary);">$${due.toFixed(2)}</span></span>
                <span>Total Paid: <span style="color:var(--success);">$${totalPaid.toFixed(2)}</span></span>
                <span>Remaining: <span style="color:${remaining > 0.005 ? 'var(--danger)' : 'var(--success)'};">$${remaining.toFixed(2)}</span></span>`;
        }

        tbody.innerHTML = withRemaining.length ? [...withRemaining].reverse().map(e => `
            <tr>
                <td>${this.formatDateAR(e.date)}</td>
                <td>${e.tooth ? this.escapeHTML(e.tooth) : '--'}</td>
                <td>${e.treatment ? this.escapeHTML(e.treatment) : '--'}</td>
                <td><strong style="color:var(--success);">$${(parseFloat(e.paid) || 0).toFixed(2)}</strong></td>
                <td>${e.note ? this.escapeHTML(e.note) : '--'}</td>
                <td><strong>$${e.remaining.toFixed(2)}</strong></td>
                <td><button class="btn btn-danger btn-sm" onclick="window.app.deleteOrthoEntry('${e.id}')">🗑️</button></td>
            </tr>`).join('')
            : `<tr><td colspan="7" class="empty-state-row"><span class="empty-state-icon">🦷</span><span class="empty-state-text">${this.t('لا توجد حركات مسجلة بعد.', 'No entries recorded yet.')}</span></td></tr>`;
    }

    // ==========================================
    // NOTIFICATIONS (lab due-date reminders + next-appointment reminders)
    // ==========================================
    async refreshNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        if (!badge) return;
        const all = await window.db.getAll('notifications');
        const count = all.filter(n => !n.acknowledged).length;
        if (count > 0) { badge.textContent = count > 99 ? '99+' : String(count); badge.style.display = 'flex'; }
        else badge.style.display = 'none';
    }

    async createNotification({ type, refId, patientId, title, message }) {
        await window.db.put('notifications', {
            id: 'ntf_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            type, refId, patientId: patientId || null, title, message,
            acknowledged: false, acknowledgedAt: null,
            createdAt: new Date().toISOString()
        });
    }

    // Whole days from today to an ISO date (0 = today, 1 = tomorrow, negative = past).
    // Reminder wording is built from this when SHOWN, never stored, so it can't go stale.
    daysFromToday(dateISO) {
        const a = new Date(`${this.normalizeStoredDate(dateISO)}T12:00:00`), b = new Date(`${this.todayISO()}T12:00:00`);
        return isNaN(a) ? null : Math.round((a - b) / 86400000);
    }

    async getNotificationText(n) {
        const fallback = { title: n.title || this.t('تذكير', 'Reminder'), message: n.message || '' };
        try {
            if (n.type === 'appt_reminder') {
                const a = await window.db.get('appointments', n.refId);
                if (!a || !a.date) return fallback;
                const pat = a.patientId ? await window.db.get('patients', a.patientId) : null;
                const name = pat ? pat.name : '--', d = this.daysFromToday(a.date);
                const when = d === 0 ? this.t('اليوم', 'today') : d === 1 ? this.t('غداً', 'tomorrow') : d === -1 ? this.t('أمس', 'yesterday') : this.t('بتاريخ', 'on');
                const dateTxt = this.formatDateAR(a.date), time = a.time || '--:--', proc = a.procedure ? ` (${a.procedure})` : '';
                const past = d !== null && d < 0;
                return {
                    title: d === 0 ? this.t('تذكير بموعد اليوم', 'Reminder: appointment today') : d === 1 ? this.t('تذكير بموعد غداً', 'Reminder: appointment tomorrow') : this.t('تذكير بموعد', 'Appointment reminder'),
                    message: this.t(
                        `تذكير: ${past ? 'كان لدى' : 'لدى'} المريض ${name} موعد ${when} ${dateTxt} الساعة ${time}${proc}.`,
                        `Reminder: ${name} ${past ? 'had' : 'has'} an appointment ${when} (${dateTxt}) at ${time}${proc}.`
                    )
                };
            }
            if (n.type === 'lab_due') {
                const c = await window.db.get('lab_cases', n.refId);
                if (!c || !c.dueDate) return fallback;
                const pat = c.patientId ? await window.db.get('patients', c.patientId) : null;
                const d = this.daysFromToday(c.dueDate);
                const when = d === 0 ? this.t('اليوم', 'today') : d === -1 ? this.t('أمس', 'yesterday') : this.t('بتاريخ', 'on');
                return {
                    title: fallback.title,
                    message: this.t(
                        `حان موعد استلام طلب المختبر ${c.caseNumber} (${c.workType}) للمريض ${pat ? pat.name : '--'} من مختبر ${c.labName} — ${when} ${this.formatDateAR(c.dueDate)}.`,
                        `Lab case ${c.caseNumber} (${c.workType}) for ${pat ? pat.name : '--'} is due back from ${c.labName} — ${when} (${this.formatDateAR(c.dueDate)}).`
                    )
                };
            }
        } catch { /* fall back to the stored text */ }
        return fallback;
    }

    // Fires once per due event (lab case past its due-date noon, or an
    // appointment marked with the reminder checkbox reaching noon the day
    // before) — a notification is created only the first time each is found
    // due, so re-checking every minute never duplicates it.
    async checkForDueNotifications() {
        const now = new Date();
        const notifications = await window.db.getAll('notifications');
        const hasNotif = (type, refId) => notifications.some(n => n.type === type && n.refId === refId);

        const labCases = await window.db.getAll('lab_cases');
        for (const c of labCases) {
            if (c.status !== 'in_lab' || !c.dueDate) continue;
            const trigger = new Date(`${this.normalizeStoredDate(c.dueDate)}T12:00:00`);
            if (isNaN(trigger) || now < trigger || hasNotif('lab_due', c.id)) continue;
            const pat = c.patientId ? await window.db.get('patients', c.patientId) : null;
            await this.createNotification({
                type: 'lab_due', refId: c.id, patientId: c.patientId,
                title: this.t('موعد استلام طلب مختبر', 'Lab case due for delivery'),
                message: this.t(
                    `حان موعد استلام طلب المختبر ${c.caseNumber} (${c.workType}) للمريض ${pat ? pat.name : '--'} من مختبر ${c.labName}.`,
                    `Lab case ${c.caseNumber} (${c.workType}) for ${pat ? pat.name : '--'} is due back from ${c.labName} today.`
                )
            });
        }

        const appointments = await window.db.getAll('appointments');
        for (const a of appointments) {
            if (!a.reminderEnabled || !a.date || a.status === 'cancelled') continue;
            const apptDate = new Date(`${this.normalizeStoredDate(a.date)}T00:00:00`);
            if (isNaN(apptDate)) continue;
            const trigger = new Date(apptDate);
            trigger.setDate(trigger.getDate() - 1);
            trigger.setHours(12, 0, 0, 0);
            if (now < trigger || hasNotif('appt_reminder', a.id)) continue;
            if (this.daysFromToday(a.date) < 0) continue; // appointment already passed: a reminder is pointless
            const pat = a.patientId ? await window.db.get('patients', a.patientId) : null;
            await this.createNotification({
                type: 'appt_reminder', refId: a.id, patientId: a.patientId,
                title: this.t('تذكير بموعد غداً', 'Reminder: appointment tomorrow'),
                message: this.t(
                    `تذكير: لدى المريض ${pat ? pat.name : '--'} موعد غداً ${this.formatDateAR(a.date)} الساعة ${a.time || '--:--'}${a.procedure ? ` (${a.procedure})` : ''}.`,
                    `Reminder: ${pat ? pat.name : '--'} has an appointment tomorrow ${this.formatDateAR(a.date)} at ${a.time || '--:--'}${a.procedure ? ` (${a.procedure})` : ''}.`
                )
            });
        }

        await this.refreshNotificationBadge();
        await this.showPendingReminderModals();
    }

    // The reminder popup stays up until "OK" is clicked; only one shows at a
    // time, and acknowledging it reveals the next pending one, if any.
    async showPendingReminderModals() {
        if (this.currentReminderNotificationId) return;
        const modal = document.getElementById('notificationReminderModal');
        if (!modal) return;
        const all = await window.db.getAll('notifications');
        const pending = all.filter(n => !n.acknowledged).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
        if (pending.length === 0) return;
        const notif = pending[0];
        this.currentReminderNotificationId = notif.id;
        const txt = await this.getNotificationText(notif);
        document.getElementById('notificationReminderTitle').textContent = `🔔 ${txt.title}`;
        document.getElementById('notificationReminderMessage').textContent = txt.message;
        this.openModal('notificationReminderModal');
    }

    async acknowledgeCurrentReminder() {
        if (!this.currentReminderNotificationId) return;
        await this.markNotificationRead(this.currentReminderNotificationId);
        this.closeModal('notificationReminderModal');
        this.currentReminderNotificationId = null;
        await this.showPendingReminderModals();
    }

    async markNotificationRead(id) {
        const notif = await window.db.get('notifications', id);
        if (!notif || notif.acknowledged) return;
        notif.acknowledged = true;
        notif.acknowledgedAt = new Date().toISOString();
        await window.db.put('notifications', notif);
        await this.refreshNotificationBadge();
        if (document.getElementById('notificationsListModal')?.style.display === 'flex') await this.renderNotificationsList();
    }

    async deleteNotification(id) {
        if (!confirm(this.t('حذف هذا الإشعار؟', 'Delete this notification?'))) return;
        await window.db.delete('notifications', id);
        await this.refreshNotificationBadge();
        await this.renderNotificationsList();
    }

    async openNotificationsListModal() {
        await this.renderNotificationsList();
        this.openModal('notificationsListModal');
    }

    async renderNotificationsList() {
        const tbody = document.getElementById('notificationsListTableBody');
        if (!tbody) return;
        const [notifications, patients] = await Promise.all([window.db.getAll('notifications'), window.db.getAll('patients')]);
        notifications.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        const texts = new Map();
        for (const n of notifications) texts.set(n.id, await this.getNotificationText(n));

        tbody.innerHTML = notifications.length ? notifications.map(n => {
            const pat = patients.find(p => p.id === n.patientId);
            const dt = new Date(n.createdAt);
            const dateStr = isNaN(dt) ? '--' : `${this.formatDateAR(this.dateToISO(dt))} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            return `<tr>
                <td><strong>${dateStr}</strong></td>
                <td>${this.escapeHTML(texts.get(n.id).message)}</td>
                <td>${pat ? `<a href="javascript:void(0)" onclick="window.app.closeModal('notificationsListModal'); window.app.openPatientProfile('${pat.id}')" style="color:var(--primary); font-weight:700;">${this.escapeHTML(pat.name)}</a>` : '--'}</td>
                <td><span class="badge ${n.acknowledged ? 'badge-green' : 'badge-amber'}">${n.acknowledged ? this.t('مقروء', 'Read') : this.t('غير مقروء', 'Unread')}</span></td>
                <td>
                    <div style="display:flex; gap:6px;">
                        ${n.acknowledged ? '' : `<button class="btn btn-outline btn-sm" onclick="window.app.markNotificationRead('${n.id}')">✔️ ${this.t('تعليم كمقروء', 'Mark read')}</button>`}
                        <button class="btn btn-danger btn-sm" onclick="window.app.deleteNotification('${n.id}')">🗑️</button>
                    </div>
                </td>
            </tr>`;
        }).join('') : `<tr><td colspan="5" class="empty-state-row"><span class="empty-state-icon">🔔</span><span class="empty-state-text">${this.t('لا توجد إشعارات بعد.', 'No notifications yet.')}</span></td></tr>`;
    }

    // ==========================================
    // 5. POST-OP INSTRUCTIONS & PATIENT CARE
    // ==========================================
    async loadInstructionsList() {
        const list = await window.db.getAll('instructions');
        const container = document.getElementById('instructionsContainer');
        if (!container) return;

        container.innerHTML = list.map(inst => `
            <div class="panel-card" style="margin-bottom:18px;">
                <div class="panel-header">
                    <h3 dir="rtl">🩺 ${this.escapeHTML(inst.title)}</h3>
                    <button class="btn btn-outline btn-sm" onclick="window.app.printInstruction('${inst.id}')">🖨️ ${this.t('طباعة التعليمات للمريض', 'Print Instructions for Patient')}</button>
                </div>
                <div class="panel-body" dir="rtl">
                    <ul style="padding-inline-start:22px; padding-inline-end:0; line-height:1.9; color:var(--text-main); text-align:right;">
                        ${inst.points.map(p => `<li>${p}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `).join('');
    }

    async printInstruction(instId) {
        const inst = await window.db.get('instructions', instId);
        const clinic = await window.db.get('settings', 'clinic_info');
        if (!inst) return;

        const printArea = document.getElementById('printableContent');
        printArea.innerHTML = `
            ${this.buildLetterheadHTML()}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="color:var(--primary); margin:0;">${this.t('إرشادات وتعليمات طبية هامة', 'Important Medical Instructions & Guidance')}</h3>
                <p style="margin:0; color:#475569; font-size:0.9rem;">${this.t('التاريخ', 'Date')}: ${this.formatDateAR(this.todayISO())}</p>
            </div>
            <div dir="rtl" style="margin:25px 0; text-align:right;">
                <h2 style="color:var(--primary); margin-bottom:15px; border-bottom:1px solid #ddd; padding-bottom:8px;">${this.escapeHTML(inst.title)}</h2>
                <ul style="padding-inline-start:25px; padding-inline-end:0; line-height:2.2; font-size:1.05rem;">
                    ${inst.points.map(p => `<li><strong>${p}</strong></li>`).join('')}
                </ul>
            </div>
            <div style="margin-top:50px; text-align:center; border-top:1px solid #ccc; padding-top:10px; color:#555; font-size:0.9rem;">
                ${this.t('صحتكم وسلامتكم هي أولويتنا دائماً', 'Your health and safety are always our top priority')}
            </div>
            ${this.buildLetterheadFooterHTML(clinic)}
        `;

        window.print();
    }

    // ==========================================
    // 6. PATIENT COMPREHENSIVE TREATMENT REPORT (ToothLogic Feature)
    // ==========================================
    async printPatientComprehensiveReport() {
        if (!this.activePatient) return;
        const clinic = await window.db.get('settings', 'clinic_info');
        const p = this.activePatient;
        const plans = p.treatmentPlans || [];
        const visits = p.visits || [];
        const teeth = p.teethRecord || {};

        const totalCost = plans.reduce((s, pl) => s + (parseFloat(pl.cost)||0), 0);

        const printArea = document.getElementById('printableContent');
        printArea.innerHTML = `
            ${this.buildLetterheadHTML()}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h2 style="color:var(--primary); font-size:1.3rem; margin:0;">${this.t('تقرير المعالجة السريرية للأسنان', 'Dental Treatment Report')}</h2>
                <p style="margin:0; color:#475569; font-size:0.9rem;">${this.t('تاريخ التقرير', 'Report Date')}: <strong>${this.formatDateAR(this.todayISO())}</strong></p>
            </div>

            <div style="margin:18px 0; padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                <div>${this.t('اسم المريض', 'Patient Name')}: <strong>${this.escapeHTML(p.name)}</strong></div>
                <div>${this.t('رقم الملف', 'Record No.')}: <strong>${this.escapeHTML(p.patientCode)}</strong></div>
                <div>${this.t('العمر / الجنس', 'Age / Gender')}: <strong>${p.age || '--'} ${this.t('سنة', 'yrs')} (${this.genderLabel(p.gender)})</strong></div>
                <div>${this.t('الهاتف', 'Phone')}: <strong>${this.escapeHTML(p.phone || '--')}</strong></div>
            </div>

            <h3 style="color:var(--primary); margin:20px 0 8px 0; border-bottom:1px solid #ccc; padding-bottom:4px;">1. ${this.t('سجل الأسنان والإجراءات المنفذة', 'Dental Status & Treatments')}</h3>
            <table>
                <thead>
                    <tr>
                        <th>${this.t('السن', 'Tooth')}</th>
                        <th>${this.t('التشخيص / الإجراء', 'Diagnosis / Procedure')}</th>
                        <th>${this.t('الأسطح', 'Surfaces')}</th>
                        <th>${this.t('حالة العلاج', 'Treatment Status')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${plans.length === 0 ? `<tr><td colspan="4" style="text-align:center;">${this.t('لا توجد إجراءات مسجلة.', 'No procedures recorded.')}</td></tr>` :
                    plans.map(pl => `
                        <tr>
                            <td><strong>${pl.toothNum ? this.t('سن', 'Tooth') + ' ' + pl.toothNum : this.t('عام', 'General')}</strong></td>
                            <td>${this.escapeHTML(pl.procedure)}</td>
                            <td>${pl.surfaces && pl.surfaces.length > 0 ? pl.surfaces.join(', ') : '--'}</td>
                            <td>${pl.status === 'completed' ? this.t('مكتمل بنجاح ✅', 'Completed successfully ✅') : (pl.status === 'in_progress' ? this.t('قيد المتابعة', 'In Progress') : this.t('مجدول', 'Planned'))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <h3 style="color:var(--primary); margin:25px 0 8px 0; border-bottom:1px solid #ccc; padding-bottom:4px;">2. ${this.t('ملخص الجلسات السريرية المنجزة', 'Clinical Visits Summary')}</h3>
            <table>
                <thead>
                    <tr>
                        <th>${this.t('التاريخ', 'Date')}</th>
                        <th>${this.t('الشكوى', 'Chief Complaint')}</th>
                        <th>${this.t('الإجراء المنجز في العيادة', 'Procedure Performed')}</th>
                        <th>${this.t('الملاحظات الطبية', 'Doctor Notes')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${visits.length === 0 ? `<tr><td colspan="4" style="text-align:center;">${this.t('لا توجد جلسات مسجلة.', 'No sessions recorded.')}</td></tr>` :
                    visits.map(v => `
                        <tr>
                            <td>${this.formatDateAR(v.date)}</td>
                            <td>${this.escapeHTML(v.chiefComplaint || '--')}</td>
                            <td><strong>${this.escapeHTML(v.procedureDone || '--')}</strong></td>
                            <td>${this.escapeHTML(v.doctorNotes || '--')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top:30px; padding:12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px;">
                <p style="font-weight:bold; color:#166534; margin-bottom:5px;">${this.t('توصيات العناية اليومية:', 'Daily Care Recommendations:')}</p>
                <p style="font-size:0.9rem; color:#1e293b;">• ${this.t('تنظيف الأسنان بالفرشاة والمعجون مرتين يومياً على الأقل واستخدام خيط الأسنان الطبي.', 'Brush teeth at least twice daily and use dental floss.')}</p>
                <p style="font-size:0.9rem; color:#1e293b;">• ${this.t('المراجعة الدورية للعيادة كل 6 أشهر للفحص الوقائي والتنظيف.', 'Visit the clinic every 6 months for a preventive checkup and cleaning.')}</p>
            </div>

            <div style="margin-top:45px; display:flex; justify-content:space-between; align-items:flex-end;">
                <div>${this.t('توقيع وختم الطبيب المعالج', "Treating Doctor's Signature & Stamp")}: _________________</div>
            </div>
            ${this.buildLetterheadFooterHTML(clinic)}
        `;

        window.print();
    }

    // ==========================================
    // 7. INVOICING & BILLING
    // ==========================================
    async loadPatientInvoices() {
        if (!this.activePatient) return;
        this.scheduleWorkspaceRefresh();
        const invoices = await window.db.getAll('invoices');
        const payments = await window.db.getAll('payments');

        const patInvoices = invoices.filter(inv => inv.patientId === this.activePatient.id);
        const patPayments = payments.filter(p => p.patientId === this.activePatient.id);

        const totalBilled = patInvoices.reduce((sum, i) => sum + (parseFloat(i.netTotal) || 0), 0);
        const totalPaid = patPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const balance = totalBilled - totalPaid;

        document.getElementById('patFinancialSummary').innerHTML = `
            <div style="display:flex; gap:20px; flex-wrap:wrap; background:#f0fdf4; border:1px solid #bbf7d0; padding:15px; border-radius:8px; margin-bottom:15px;">
                <div>${this.t('إجمالي المطالبات', 'Total Billed')}: <strong>$${totalBilled.toFixed(2)}</strong></div>
                <div>${this.t('إجمالي المسدد', 'Total Paid')}: <strong style="color:var(--success);">$${totalPaid.toFixed(2)}</strong></div>
                <div>${this.t('الرصيد المتبقي', 'Outstanding Balance')}: <strong style="color:${balance > 0 ? 'var(--danger)' : 'var(--success)'}; font-size:1.1rem;">$${balance.toFixed(2)}</strong></div>
            </div>
        `;

        const tbody = document.getElementById('patInvoicesTableBody');
        if (tbody) {
            if (patInvoices.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="empty-state-row"><span class="empty-state-icon">🧾</span><span class="empty-state-text">${this.t('لا توجد فواتير منشأة لهذا المريض.', 'No invoices have been created for this patient.')}</span></td></tr>`;
            } else {
                tbody.innerHTML = patInvoices.map(inv => {
                    const invPaid = patPayments.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + (parseFloat(p.amount)||0), 0);
                    const invDue = inv.netTotal - invPaid;
                    // An invoice can bill several items on different teeth — list
                    // whichever tooth numbers its items actually carry, if any.
                    const teeth = [...new Set((inv.items || []).map(it => it.toothNum).filter(Boolean))].sort((a, b) => a - b);
                    return `
                    <tr>
                        <td><button type="button" class="invoice-number-link" onclick="window.app.openInvoiceDetailsModal('${inv.id}')" title="${this.t('عرض تفاصيل الفاتورة والدفعات', 'View invoice details and payments')}">${this.escapeHTML(inv.invoiceNumber)}</button></td>
                        <td>${this.formatDateAR(inv.date)}</td>
                        <td>${teeth.length ? teeth.join(', ') : '--'}</td>
                        <td>$${inv.netTotal.toFixed(2)}</td>
                        <td><strong style="color:var(--success);">$${invPaid.toFixed(2)}</strong></td>
                        <td><strong style="color:${invDue > 0 ? 'var(--danger)' : 'var(--success)'};">$${invDue.toFixed(2)}</strong></td>
                        <td><span class="badge ${invDue <= 0 ? 'badge-green' : 'badge-rose'}">${invDue <= 0 ? this.t('مسددة', 'Paid') : this.t('متبقي', 'Outstanding')}</span></td>
                        <td>
                            <div style="display:flex; gap:6px; align-items:center;">
                                ${invDue > 0.005 ? `<button class="btn btn-primary btn-sm" onclick="window.app.openRecordPaymentModal('${inv.id}')">💵 ${this.t('إضافة دفعة', 'Add Payment')}</button>` : `<button class="btn btn-outline btn-sm" onclick="window.app.printInvoice('${inv.id}')">🖨️ ${this.t('طباعة', 'Print')}</button>`}
                                ${this.buildRowActionsMenu([
                                    { icon: '✏️', label: this.t('تعديل', 'Edit'), onclick: `window.app.openEditInvoiceModal('${inv.id}')` },
                                    invDue > 0.005 ? { icon: '🖨️', label: this.t('طباعة', 'Print'), onclick: `window.app.printInvoice('${inv.id}')` } : null,
                                    { icon: '📄', label: this.t('تصدير PDF', 'Export PDF'), onclick: `window.app.exportInvoiceToPDF('${inv.id}')` },
                                    { icon: '🗑️', label: this.t('حذف', 'Delete'), onclick: `window.app.deleteInvoice('${inv.id}')`, danger: true }
                                ])}
                            </div>
                        </td>
                    </tr>
                    `;
                }).join('');
            }
        }
    }

    // Removes one receipt (e.g. one entered by mistake); the invoice itself stays.
    // Delete from the Statement of Account: an invoice (with its receipts) or a single receipt.
    async deleteStatementEntry(kind, id) {
        if (kind === 'invoice') return this.deleteInvoice(id);
        if (kind === 'plan') {
            // A "not invoiced yet" line is a treatment-plan procedure with no invoice. Removing it
            // never touches any invoice or payment.
            const plan = (this.activePatient?.treatmentPlans || []).find(p => p.id === id);
            if (!plan) return;
            if (!confirm(this.t(`حذف الإجراء «${plan.procedure}» غير المفوتر؟ سيُحذف من الخطة والجلسات والمخطط فقط، ولن تتأثر أي فاتورة أو دفعة.`,
                `Delete the un-invoiced procedure "${plan.procedure}"? It is removed from the plan, sessions and chart only — no invoice or payment is affected.`))) return;
            await this.deleteTreatmentPlan(id);
            await this.loadPatientInvoices();
            await this.refreshDashboard();
            return;
        }
        const payment = await window.db.get('payments', id);
        if (payment) return this.deletePayment(id, payment.invoiceId, true);
    }

    async deletePayment(paymentId, invoiceId, fromStatement = false) {
        const payment = await window.db.get('payments', paymentId);
        if (!payment) return;
        const msg = this.t(`حذف السند ${payment.receiptNumber || ''} بمبلغ $${(parseFloat(payment.amount) || 0).toFixed(2)}؟ لا يمكن التراجع.`,
            `Delete receipt ${payment.receiptNumber || ''} of $${(parseFloat(payment.amount) || 0).toFixed(2)}? This cannot be undone.`);
        if (!confirm(msg)) return;
        await window.db.delete('payments', paymentId);
        this.showToast(this.t('تم حذف السند.', 'Receipt deleted.'), 'info');
        if (!fromStatement) await this.openInvoiceDetailsModal(invoiceId);
        await this.loadPatientInvoices();
        await this.refreshDashboard();
    }

    async openInvoiceDetailsModal(invoiceId) {
        if (!this.activePatient) return;
        const invoice = await window.db.get('invoices', invoiceId);
        if (!invoice || invoice.patientId !== this.activePatient.id) {
            this.showToast(this.t('تعذر العثور على الفاتورة المطلوبة.', 'The requested invoice could not be found.'), 'error');
            return;
        }
        const payments = (await window.db.getAll('payments'))
            .filter(p => p.invoiceId === invoiceId)
            .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        const paid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const due = Math.max(0, (parseFloat(invoice.netTotal) || 0) - paid);
        const methodLabel = method => ({ cash: this.t('نقداً', 'Cash'), card: this.t('بطاقة', 'Card'), transfer: this.t('تحويل', 'Transfer') }[method] || '--');
        const items = (invoice.items || []).map((item, index) => `
            <tr><td>${index + 1}</td><td>${this.escapeHTML(item.description)}</td><td>$${(parseFloat(item.price) || 0).toFixed(2)}</td></tr>`).join('');
        const history = payments.length ? payments.map(p => `
            <tr><td>${this.escapeHTML(p.receiptNumber || '--')}</td><td>${this.formatDateAR(p.date)}</td><td>${methodLabel(p.method)}</td><td>$${(parseFloat(p.amount) || 0).toFixed(2)}</td><td>${p.itemLabel ? `[${this.escapeHTML(p.itemLabel)}] ` : ''}${this.escapeHTML(p.notes || '--')}</td>
                <td><button class="btn btn-outline btn-sm" onclick="window.app.closeModal('invoiceDetailsModal'); window.app.openEditInvoiceModal('${invoiceId}', { editPaymentId: '${p.id}' })">✏️ ${this.t('تعديل', 'Edit')}</button>
                    <button class="btn btn-danger btn-sm" onclick="window.app.deletePayment('${p.id}', '${invoiceId}')">🗑️ ${this.t('حذف', 'Delete')}</button></td></tr>`).join('') :
            `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">${this.t('لا توجد دفعات مسجلة بعد.', 'No payments recorded yet.')}</td></tr>`;

        document.getElementById('invoiceDetailsContent').innerHTML = `
            <div class="payment-invoice-summary" style="display:block; margin-top:0;">
                <strong>${this.t('الفاتورة', 'Invoice')}: ${this.escapeHTML(invoice.invoiceNumber)}</strong> — ${this.formatDateAR(invoice.date)}<br>
                ${this.t('الإجمالي', 'Total')}: <strong>$${(parseFloat(invoice.netTotal) || 0).toFixed(2)}</strong> &nbsp; | &nbsp; ${this.t('المدفوع', 'Paid')}: <strong style="color:var(--success);">$${paid.toFixed(2)}</strong> &nbsp; | &nbsp;
                ${this.t('المتبقي', 'Remaining')}: <strong style="color:${due > 0.005 ? 'var(--danger)' : 'var(--success)'};">$${due.toFixed(2)}</strong>
            </div>
            <h4>${this.t('بنود العلاج', 'Treatment Items')}</h4>
            <div class="table-responsive"><table><thead><tr><th>#</th><th>${this.t('الإجراء', 'Procedure')}</th><th>${this.t('المبلغ', 'Amount')}</th></tr></thead><tbody>${items}</tbody></table></div>
            <h4 style="margin-top:20px;">${this.t('سجل سندات القبض', 'Receipt History')}</h4>
            <div class="table-responsive"><table class="payment-history-table"><thead><tr><th>${this.t('رقم السند', 'Receipt No.')}</th><th>${this.t('التاريخ', 'Date')}</th><th>${this.t('الطريقة', 'Method')}</th><th>${this.t('المبلغ', 'Amount')}</th><th>${this.t('الملاحظات', 'Notes')}</th><th></th></tr></thead><tbody>${history}</tbody></table></div>`;
        const paymentButton = document.getElementById('invoiceDetailsPaymentBtn');
        paymentButton.style.display = due > 0.005 ? '' : 'none';
        paymentButton.onclick = () => {
            this.closeModal('invoiceDetailsModal');
            this.openRecordPaymentModal(invoiceId);
        };
        const exportButton = document.getElementById('invoiceDetailsExportBtn');
        if (exportButton) exportButton.onclick = () => this.exportInvoiceToPDF(invoiceId);
        this.openModal('invoiceDetailsModal');
    }

    // ==========================================
    // INVOICE & PAYMENT (one page: invoice on top, payment below)
    // ==========================================
    newItemId() {
        return 'it_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    attrEscape(value) {
        return this.escapeHTML(value).replace(/"/g, '&quot;');
    }

    paymentMethodLabel(method) {
        return method === 'cash' ? this.t('نقدي', 'Cash') : (method === 'card' ? this.t('بطاقة', 'Card') : this.t('تحويل', 'Transfer'));
    }

    // Dropdown behind "Add another item": every service in the price list,
    // grouped by category, each shown with its price.
    async buildServicePickerHTML() {
        const services = (await window.db.getAll('services'))
            .sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')) || String(a.name || '').localeCompare(String(b.name || '')));
        this.servicePickerMap = {};
        const groups = {};
        services.forEach(s => {
            this.servicePickerMap[s.id] = s;
            const cat = s.category || this.t('أخرى', 'Other');
            (groups[cat] = groups[cat] || []).push(s);
        });
        this.servicePickerHTML = `<option value="">${this.t('— اختر خدمة —', '— Choose a service —')}</option>` +
            Object.keys(groups).map(cat => `<optgroup label="${this.attrEscape(cat)}">${groups[cat].map(s =>
                `<option value="${s.id}">${this.escapeHTML(s.name)} — $${(parseFloat(s.price) || 0).toFixed(2)}</option>`).join('')}</optgroup>`).join('');
    }

    onInvoiceServicePicked(select) {
        const svc = (this.servicePickerMap || {})[select.value];
        if (!svc) return;
        const row = select.closest('.invoice-item-row');
        row.querySelector('.inv-item-desc').value = svc.name;
        row.querySelector('.inv-item-price').value = parseFloat(svc.price) || 0;
        this.calculateInvoiceTotals();
    }

    // Every other invoice of this patient, with what is still owed on it and
    // on each of its procedures, so a payment can be pointed at any of them.
    async loadOtherInvoices(excludeId) {
        const [invoices, payments] = await Promise.all([window.db.getAll('invoices'), window.db.getAll('payments')]);
        this.otherInvoices = invoices
            .filter(i => i.patientId === this.activePatient.id && i.id !== excludeId)
            .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
            .map(inv => {
                // Items saved before per-procedure payments get a stable id from their position.
                const items = (inv.items || []).map((it, idx) => ({ ...it, itemId: it.itemId || `${inv.id}#${idx}` }));
                const paidByItem = {};
                let paid = 0;
                payments.filter(p => p.invoiceId === inv.id).forEach(p => {
                    const a = parseFloat(p.amount) || 0;
                    paid += a;
                    if (p.itemId) paidByItem[p.itemId] = (paidByItem[p.itemId] || 0) + a;
                });
                return { inv, items, paid, paidByItem, remaining: Math.max(0, (parseFloat(inv.netTotal) || 0) - paid) };
            });
    }

    resetPaymentSection(payments) {
        this.invoiceModalPayments = payments || [];
        this.editingPaymentId = null;
        document.getElementById('paymentAmount').value = '';
        document.getElementById('paymentMethod').value = 'cash';
        document.getElementById('paymentNotes').value = '';
        this.setDateInput('paymentDate', this.todayISO());
        const banner = document.getElementById('payEditBanner');
        if (banner) banner.style.display = 'none';
        const box = document.getElementById('invPreviousPayments');
        const list = this.invoiceModalPayments;
        box.innerHTML = list.length ? `
            <table class="pay-prev-table"><thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th>For</th><th>Amount</th><th></th></tr></thead><tbody>
            ${list.map(p => `<tr><td>${this.escapeHTML(p.receiptNumber || '--')}</td><td>${this.formatDateAR(p.date)}</td><td>${this.paymentMethodLabel(p.method)}</td>
                <td>${this.escapeHTML(p.itemLabel || 'Whole invoice')}</td><td>$${(parseFloat(p.amount) || 0).toFixed(2)}</td>
                <td><button type="button" class="btn btn-outline btn-sm" onclick="window.app.editInvoicePayment('${p.id}')" title="Edit this payment">✏️ Edit</button></td></tr>`).join('')}
            </tbody></table>` : '';
    }

    // Loads an existing payment into the form so its amount (or anything
    // else) can be changed; saving updates that receipt instead of adding one.
    editInvoicePayment(paymentId) {
        const p = (this.invoiceModalPayments || []).find(x => x.id === paymentId);
        if (!p) return;
        this.editingPaymentId = paymentId;
        this.calculateInvoiceTotals();
        document.getElementById('paymentAmount').value = p.amount;
        this.setDateInput('paymentDate', p.date);
        document.getElementById('paymentMethod').value = p.method || 'cash';
        document.getElementById('paymentNotes').value = p.notes || '';
        const target = document.getElementById('paymentTarget');
        target.value = p.itemId || '';
        if (target.value !== (p.itemId || '')) target.value = '';
        const banner = document.getElementById('payEditBanner');
        if (banner) {
            banner.style.display = 'flex';
            banner.querySelector('span').textContent = `Editing receipt ${p.receiptNumber || ''} — change the amount or details, then Save.`;
        }
        document.getElementById('invPaymentSection').scrollIntoView({ block: 'center' });
        document.getElementById('paymentAmount').focus();
    }

    cancelPaymentEdit() {
        this.editingPaymentId = null;
        document.getElementById('paymentAmount').value = '';
        document.getElementById('paymentNotes').value = '';
        document.getElementById('paymentTarget').value = '';
        const banner = document.getElementById('payEditBanner');
        if (banner) banner.style.display = 'none';
        this.calculateInvoiceTotals();
    }

    getPaidByItem() {
        const byItem = {};
        let all = 0;
        (this.invoiceModalPayments || []).filter(p => p.id !== this.editingPaymentId).forEach(p => {
            const a = parseFloat(p.amount) || 0;
            all += a;
            if (p.itemId) byItem[p.itemId] = (byItem[p.itemId] || 0) + a;
        });
        return { byItem, all };
    }

    // Lets the doctor say which procedure (tooth) a payment is for.
    refreshPaymentTargets() {
        const sel = document.getElementById('paymentTarget');
        if (!sel) return;
        const previous = sel.value;
        const { byItem } = this.getPaidByItem();
        let html = `<option value="">Whole invoice (general)</option>`;
        document.querySelectorAll('.invoice-item-row').forEach(row => {
            const desc = row.querySelector('.inv-item-desc').value.trim();
            if (!desc) return;
            const price = parseFloat(row.querySelector('.inv-item-price').value) || 0;
            if (price <= 0) return; // nothing to pay on a $0 line (e.g. a missing tooth)
            const left = Math.max(0, price - (byItem[row.dataset.itemId] || 0));
            html += `<option value="${row.dataset.itemId}">${this.escapeHTML(desc)} — left $${left.toFixed(2)}</option>`;
        });
        // Other invoices of the same patient that still have a balance (not
        // offered while editing an existing receipt, which stays on its invoice).
        if (!this.editingPaymentId) {
            (this.otherInvoices || []).filter(o => o.remaining > 0.005).forEach(o => {
                html += `<optgroup label="${this.attrEscape(o.inv.invoiceNumber)} (${this.formatDateAR(o.inv.date)})">`;
                html += `<option value="inv:${o.inv.id}">Whole invoice ${this.escapeHTML(o.inv.invoiceNumber)} — left $${o.remaining.toFixed(2)}</option>`;
                o.items.forEach(it => {
                    const itemLeft = Math.max(0, (parseFloat(it.price) || 0) - (o.paidByItem[it.itemId] || 0));
                    if (itemLeft > 0.005) html += `<option value="${o.inv.id}|${it.itemId}">${this.escapeHTML(it.description)} — left $${itemLeft.toFixed(2)}</option>`;
                });
                html += `</optgroup>`;
            });
        }
        sel.innerHTML = html;
        if (Array.from(sel.options).some(o => o.value === previous)) sel.value = previous;
    }

    calculateInvoiceTotals() {
        const { byItem, all: paidAll } = this.getPaidByItem();
        let subtotal = 0;
        document.querySelectorAll('.invoice-item-row').forEach(row => {
            const price = parseFloat(row.querySelector('.inv-item-price').value) || 0;
            subtotal += price;
            const paidItem = byItem[row.dataset.itemId] || 0;
            const label = row.querySelector('.inv-item-paid');
            if (label) label.textContent = paidItem > 0 ? `Paid $${paidItem.toFixed(2)} · left $${Math.max(0, price - paidItem).toFixed(2)}` : '';
        });

        const discount = parseFloat(document.getElementById('invDiscount').value) || 0;
        const netTotal = Math.max(0, subtotal - discount);
        this.invoiceModalNet = netTotal;

        document.getElementById('invSubtotalDisplay').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('invNetTotalDisplay').textContent = `$${netTotal.toFixed(2)}`;

        const remaining = Math.max(0, netTotal - paidAll);
        const summary = document.getElementById('invPaySummary');
        if (summary) {
            summary.innerHTML = `<span>Invoice total: <strong>$${netTotal.toFixed(2)}</strong></span>
                <span>Paid so far: <strong style="color:var(--success);">$${paidAll.toFixed(2)}</strong></span>
                <span>Remaining: <strong style="color:${remaining > 0.005 ? 'var(--danger)' : 'var(--success)'};">$${remaining.toFixed(2)}</strong></span>`;
        }
        this.refreshPaymentTargets();
    }

    // "Close account": fills in exactly what the patient still owes.
    closeAccount() {
        this.calculateInvoiceTotals();
        const remaining = Math.max(0, (this.invoiceModalNet || 0) - this.getPaidByItem().all);
        if (remaining <= 0.005) {
            this.showToast(this.t('لا يوجد مبلغ متبقٍ على هذه الفاتورة.', 'Nothing is left to pay on this invoice.'), 'info');
            return;
        }
        document.getElementById('paymentTarget').value = '';
        document.getElementById('paymentAmount').value = remaining.toFixed(2);
    }

    // Quick-action entry point: new invoice if there is un-invoiced work,
    // otherwise the oldest invoice that still has a balance, otherwise a new one.
    async openInvoicePayment() {
        if (!this.activePatient) return;
        const data = await this.loadPatientRelatedRecords();
        const invoicedPlanIds = new Set(data.invoices.flatMap(i => (i.items || []).map(it => it.treatmentPlanId).filter(Boolean)));
        const hasNewWork = (this.activePatient.treatmentPlans || []).some(p => !invoicedPlanIds.has(p.id) && p.condition !== 'missing');
        const unpaid = data.invoices
            .map(i => ({ inv: i, due: (parseFloat(i.netTotal) || 0) - data.payments.filter(p => p.invoiceId === i.id).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) }))
            .filter(x => x.due > 0.005)
            .sort((a, b) => String(a.inv.date).localeCompare(String(b.inv.date)));
        if (!hasNewWork && unpaid.length > 0) return this.openRecordPaymentModal(unpaid[0].inv.id);
        return this.openCreateInvoiceModal();
    }

    async openCreateInvoiceModal() {
        if (!this.activePatient) return;
        this.editingInvoiceId = null;
        const titleEl = document.getElementById('createInvoiceModalTitle');
        if (titleEl) titleEl.textContent = this.t('🧾 فاتورة ودفعة جديدة', '🧾 New Invoice & Payment');
        const nextInvNum = await window.db.getNextInvoiceNumber();
        document.getElementById('invNumberDisplay').value = nextInvNum;
        this.setDateInput('invDate', this.todayISO());
        document.getElementById('invDiscount').value = 0;
        await this.buildServicePickerHTML();
        await this.loadOtherInvoices(null);
        this.resetPaymentSection([]);

        const container = document.getElementById('invoiceItemsContainer');
        container.innerHTML = '';

        const invoices = await window.db.getAll('invoices');
        const invoicedPlanIds = new Set(invoices
            .filter(i => i.patientId === this.activePatient.id)
            .flatMap(i => (i.items || []).map(item => item.treatmentPlanId).filter(Boolean)));
        // A missing tooth is a chart status, not billable work, so it never goes on an invoice.
        const notInvoiced = (this.activePatient.treatmentPlans || []).filter(p => !invoicedPlanIds.has(p.id) && p.condition !== 'missing');
        // Work already started/finished first; if none, whatever is planned.
        let plans = notInvoiced.filter(p => p.status === 'completed' || p.status === 'in_progress');
        if (plans.length === 0) plans = notInvoiced.filter(p => p.status === 'planned');
        if (plans.length > 0) {
            plans.forEach(p => this.addInvoiceItemRow(p.procedure, p.cost, p.id, '', false, p.toothNum || ''));
        } else {
            // No procedures on file: bill the reason for today's visit at its
            // catalog price (or the Checkup price) instead of a generic line.
            const appt = await this.getCurrentAppointment(this.activePatient.id);
            const services = await window.db.getAll('services');
            const reason = (appt?.procedure || '').trim();
            const match = reason ? services.find(s => String(s.name || '').toLowerCase() === reason.toLowerCase() || reason.toLowerCase().includes(String(s.name || '').toLowerCase())) : null;
            const checkup = services.find(s => s.id === 'svc_checkup');
            this.addInvoiceItemRow(reason || checkup?.name || this.t('كشف', 'Checkup'), match ? match.price : (checkup ? checkup.price : 0));
        }

        this.calculateInvoiceTotals();
        this.openModal('createInvoiceModal');
    }

    async openEditInvoiceModal(invoiceId, options = {}) {
        if (!this.activePatient) return;
        const invoice = await window.db.get('invoices', invoiceId);
        if (!invoice || invoice.patientId !== this.activePatient.id) return;

        this.editingInvoiceId = invoiceId;
        const titleEl = document.getElementById('createInvoiceModalTitle');
        if (titleEl) titleEl.textContent = this.t(`🧾 فاتورة ودفعة — ${invoice.invoiceNumber}`, `🧾 Invoice & Payment — ${invoice.invoiceNumber}`);
        document.getElementById('invNumberDisplay').value = invoice.invoiceNumber;
        this.setDateInput('invDate', invoice.date);
        document.getElementById('invDiscount').value = invoice.discount || 0;
        await this.buildServicePickerHTML();
        await this.loadOtherInvoices(invoiceId);
        const payments = (await window.db.getAll('payments')).filter(p => p.invoiceId === invoiceId)
            .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        this.resetPaymentSection(payments);

        const container = document.getElementById('invoiceItemsContainer');
        container.innerHTML = '';
        (invoice.items || []).forEach((item, idx) => {
            this.addInvoiceItemRow(item.description, item.price, item.treatmentPlanId || '', item.itemId || `${invoiceId}#${idx}`, false, item.toothNum || '');
        });
        if (container.children.length === 0) this.addInvoiceItemRow('', 0);

        this.calculateInvoiceTotals();
        this.openModal('createInvoiceModal');
        if (options.editPaymentId) {
            setTimeout(() => this.editInvoicePayment(options.editPaymentId), 80);
        } else if (options.focusPayment) {
            const section = document.getElementById('invPaymentSection');
            setTimeout(() => { section.scrollIntoView({ block: 'center' }); document.getElementById('paymentAmount').focus(); }, 80);
        }
    }

    // Kept for the "Add Payment" buttons: payments are now taken in the same
    // window as the invoice.
    async openRecordPaymentModal(invoiceId) {
        return this.openEditInvoiceModal(invoiceId, { focusPayment: true });
    }

    addInvoiceItemRow(desc = '', price = 0, treatmentPlanId = '', itemId = '', focusPicker = false, toothNum = '') {
        const container = document.getElementById('invoiceItemsContainer');
        const div = document.createElement('div');
        div.className = 'invoice-item-row';
        div.dataset.treatmentPlanId = treatmentPlanId;
        div.dataset.itemId = itemId || this.newItemId();
        div.style = 'display:flex; gap:10px; margin-bottom:10px; align-items:center; flex-wrap:wrap;';
        div.innerHTML = `
            <select class="inv-item-service" onchange="window.app.onInvoiceServicePicked(this)" style="flex:2; min-width:160px;">${this.servicePickerHTML || ''}</select>
            <input type="text" class="inv-item-desc" placeholder="${this.t('وصف الخدمة / العلاج', 'Service / treatment description')}" value="${this.attrEscape(desc)}" style="flex:3; min-width:160px;" required oninput="window.app.refreshPaymentTargets()">
            <select class="inv-item-tooth" style="flex:0 0 140px;">${this.buildToothOptionsHTML(this.t('لا يوجد سن محدد', 'No specific tooth'))}</select>
            <input type="number" class="inv-item-price" placeholder="${this.t('السعر', 'Price')}" value="${price}" style="flex:1; min-width:80px;" oninput="window.app.calculateInvoiceTotals()" required>
            <small class="inv-item-paid"></small>
            <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); window.app.calculateInvoiceTotals();">✕</button>
        `;
        div.querySelector('.inv-item-tooth').value = toothNum || '';
        container.appendChild(div);
        if (focusPicker) div.querySelector('select').focus();
    }

    async saveInvoice(printAfter = false) {
        if (!this.activePatient) return;
        if (!document.getElementById('invoiceForm').reportValidity()) return;
        const invoiceNumber = document.getElementById('invNumberDisplay').value;
        const date = this.validateDateInput('invDate', true);
        if (date === null) return;
        const discount = parseFloat(document.getElementById('invDiscount').value) || 0;

        const items = [];
        let subtotal = 0;
        document.querySelectorAll('.invoice-item-row').forEach(row => {
            const desc = row.querySelector('.inv-item-desc').value.trim();
            const price = parseFloat(row.querySelector('.inv-item-price').value) || 0;
            const toothNum = row.querySelector('.inv-item-tooth')?.value || '';
            if (desc) {
                items.push({ itemId: row.dataset.itemId, description: desc, price, toothNum: toothNum || undefined, treatmentPlanId: row.dataset.treatmentPlanId || undefined });
                subtotal += price;
            }
        });

        if (items.length === 0) {
            this.showToast(this.t('يرجى إضافة بند واحد على الأقل للفاتورة.', 'Please add at least one item to the invoice.'), 'warning');
            return;
        }

        const netTotal = Math.max(0, subtotal - discount);

        // Check the payment first so nothing is saved if it is not valid.
        const payAmount = parseFloat(document.getElementById('paymentAmount').value) || 0;
        const editingPayment = this.editingPaymentId ? (this.invoiceModalPayments || []).find(p => p.id === this.editingPaymentId) : null;
        let payDate = null;
        let payTarget = { invoiceId: null, itemId: null, itemLabel: '' }; // invoiceId null = the invoice being saved
        if (editingPayment && payAmount <= 0) {
            this.showToast(this.t('أدخل مبلغ الدفعة.', 'Enter the payment amount.'), 'warning');
            return;
        }
        if (payAmount > 0) {
            payDate = this.validateDateInput('paymentDate', true);
            if (payDate === null) return;
            const targetValue = document.getElementById('paymentTarget').value;
            // A payment larger than what's left on the chosen invoice/item is
            // allowed on purpose: the extra becomes a credit on the patient's
            // account (see describeBalance) instead of being blocked here.
            if (targetValue.startsWith('inv:') || targetValue.includes('|')) {
                // Payment for a different invoice of this patient.
                const [otherId, otherItemId] = targetValue.startsWith('inv:') ? [targetValue.slice(4), null] : targetValue.split('|');
                const other = (this.otherInvoices || []).find(o => o.inv.id === otherId);
                if (!other) { this.showToast(this.t('الفاتورة المحددة غير موجودة.', 'The selected invoice was not found.'), 'error'); return; }
                const it = otherItemId ? other.items.find(x => x.itemId === otherItemId) : null;
                payTarget = { invoiceId: other.inv.id, itemId: it ? it.itemId : null, itemLabel: it ? `${it.description} (${other.inv.invoiceNumber})` : '' };
            } else if (targetValue) {
                const item = items.find(i => i.itemId === targetValue);
                if (item) payTarget = { invoiceId: null, itemId: item.itemId, itemLabel: item.description };
            }
        }

        let invoiceId;
        let invoiceRecord;
        if (this.editingInvoiceId) {
            const existing = await window.db.get('invoices', this.editingInvoiceId);
            if (!existing) return;
            existing.date = date;
            existing.items = items;
            existing.subtotal = subtotal;
            existing.discount = discount;
            existing.netTotal = netTotal;
            existing.updatedBy = this.activeStaff?.name || null;
            existing.updatedAt = new Date().toISOString();
            await window.db.put('invoices', existing);
            invoiceId = existing.id;
            invoiceRecord = existing;
        } else {
            invoiceRecord = {
                id: 'inv_' + Date.now(),
                invoiceNumber,
                patientId: this.activePatient.id,
                patientName: this.activePatient.name,
                date,
                items,
                subtotal,
                discount,
                netTotal,
                createdBy: this.activeStaff?.name || null,
                createdAt: new Date().toISOString()
            };
            await window.db.put('invoices', invoiceRecord);
            invoiceId = invoiceRecord.id;
        }
        this.editingInvoiceId = null;

        if (editingPayment && payAmount > 0) {
            const fresh = await window.db.get('payments', editingPayment.id);
            if (fresh) {
                Object.assign(fresh, {
                    amount: payAmount,
                    date: payDate,
                    method: document.getElementById('paymentMethod').value,
                    notes: document.getElementById('paymentNotes').value.trim(),
                    itemId: payTarget.itemId,
                    itemLabel: payTarget.itemLabel,
                    updatedBy: this.activeStaff?.name || null,
                    updatedAt: new Date().toISOString()
                });
                await window.db.put('payments', fresh);
            }
        } else if (payAmount > 0) {
            await window.db.put('payments', {
                id: 'pay_' + Date.now(),
                receiptNumber: await window.db.getNextPaymentNumber(),
                invoiceId: payTarget.invoiceId || invoiceId,
                patientId: this.activePatient.id,
                patientName: this.activePatient.name,
                amount: payAmount,
                date: payDate,
                method: document.getElementById('paymentMethod').value,
                notes: document.getElementById('paymentNotes').value.trim(),
                itemId: payTarget.itemId,
                itemLabel: payTarget.itemLabel,
                createdBy: this.activeStaff?.name || null,
                createdAt: new Date().toISOString()
            });
        }
        this.editingPaymentId = null;

        this.closeModal('createInvoiceModal');
        this.showToast(editingPayment
            ? this.t('تم تعديل الدفعة.', 'Payment updated.')
            : (payAmount > 0
                ? this.t('تم حفظ الفاتورة والدفعة بنجاح.', 'Invoice and payment saved successfully.')
                : this.t('تم حفظ الفاتورة بنجاح.', 'Invoice saved successfully.')), 'success');
        await this.loadPatientInvoices();
        await this.refreshDashboard();
        if (printAfter) await this.printInvoice(invoiceId);
    }

    // ==========================================
    // 8. PRESCRIPTIONS (Rx)
    // ==========================================
    async loadPatientPrescriptions() {
        if (!this.activePatient) return;
        this.scheduleWorkspaceRefresh();
        const prescriptions = await window.db.getAll('prescriptions');
        const patRx = prescriptions.filter(rx => rx.patientId === this.activePatient.id);

        const tbody = document.getElementById('patPrescriptionsTableBody');
        if (tbody) {
            if (patRx.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-state-row"><span class="empty-state-icon">💊</span><span class="empty-state-text">${this.t('لا توجد وصفات مسجلة للمريض.', 'No prescriptions recorded for this patient.')}</span></td></tr>`;
            } else {
                tbody.innerHTML = patRx.map(rx => `
                    <tr>
                        <td><strong>${this.formatDateAR(rx.date)}</strong></td>
                        <td>${this.escapeHTML(rx.diagnosis) || this.t('علاج أسنان', 'Dental Treatment')}</td>
                        <td>${rx.medications.length > 0 ? rx.medications.map(m => `<div>• <strong>${this.escapeHTML(m.name)}</strong> - ${this.escapeHTML(m.instructions)}</div>`).join('') : `<span style="color:var(--text-muted);">${this.t('لا يوجد دواء', 'No medication')}${rx.xrayType ? ` — 🩻 ${rx.xrayType}` : ''}</span>`}</td>
                        <td>${this.escapeHTML(rx.doctorNotes || '--')}</td>
                        <td>
                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                <button class="btn btn-primary btn-sm" onclick="window.app.printPrescription('${rx.id}')">🖨️ ${this.t('طباعة', 'Print')}</button>
                                <button class="btn btn-outline btn-sm" onclick="window.app.openEditPrescriptionModal('${rx.id}')">✏️ ${this.t('تعديل', 'Edit')}</button>
                                <button class="btn btn-outline btn-sm" onclick="window.app.exportPrescriptionToPDF('${rx.id}')">📄 ${this.t('تصدير PDF', 'Export PDF')}</button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }
    }

    openNewPrescriptionModal() {
        this.editingRxId = null;
        document.getElementById('prescriptionForm').reset();
        this.setDateInput('rxDate', this.todayISO());
        document.getElementById('rxMedsContainer').innerHTML = '';
        this.addMedicationRow();
        const xraySelect = document.getElementById('rxXrayType');
        if (xraySelect) xraySelect.value = '';
        const titleEl = document.getElementById('prescriptionModalTitle');
        if (titleEl) titleEl.textContent = this.t('💊 إنشاء وصفة طبية (Rx)', '💊 Create Prescription (Rx)');
        this.openModal('prescriptionModal');
    }

    async openEditPrescriptionModal(rxId) {
        const rx = await window.db.get('prescriptions', rxId);
        if (!rx) return;
        this.editingRxId = rxId;
        document.getElementById('prescriptionForm').reset();
        this.setDateInput('rxDate', rx.date);
        document.getElementById('rxDiagnosis').value = rx.diagnosis || '';
        document.getElementById('rxDoctorNotes').value = rx.doctorNotes || '';
        document.getElementById('rxMedsContainer').innerHTML = '';
        (rx.medications || []).forEach(m => {
            let instIndex = RX_INSTRUCTIONS_AR.indexOf(m.instructions);
            if (instIndex === -1) instIndex = 0;
            this.addMedicationRow(m.name, instIndex);
        });
        if (document.querySelectorAll('.rx-med-row').length === 0) this.addMedicationRow();
        const xraySelect = document.getElementById('rxXrayType');
        if (xraySelect) xraySelect.value = rx.xrayType || '';
        const titleEl = document.getElementById('prescriptionModalTitle');
        if (titleEl) titleEl.textContent = this.t('✏️ تعديل الوصفة الطبية (Rx)', '✏️ Edit Prescription (Rx)');
        this.openModal('prescriptionModal');
    }

    addMedicationRow(name = RX_MEDICATIONS[0], instIndex = 0) {
        const container = document.getElementById('rxMedsContainer');
        const div = document.createElement('div');
        div.className = 'rx-med-row';
        div.style = 'display:flex; gap:10px; margin-bottom:10px; align-items:center;';
        div.innerHTML = `
            <select class="rx-med-name" style="flex:2;" required>
                ${RX_MEDICATIONS.map(m => `<option value="${m}" ${m === name ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
            <select class="rx-med-inst" style="flex:3;" required dir="rtl">
                ${RX_INSTRUCTIONS_AR.map((txt, i) => `<option value="${i}" ${i === instIndex ? 'selected' : ''}>${txt}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
        `;
        container.appendChild(div);
    }

    async savePrescription(printAfter = false) {
        if (!this.activePatient) return;
        const date = this.validateDateInput('rxDate', true);
        if (date === null) return;
        const diagnosis = document.getElementById('rxDiagnosis').value.trim();
        const doctorNotes = document.getElementById('rxDoctorNotes').value.trim();
        const xrayType = document.getElementById('rxXrayType')?.value || '';

        const medications = [];
        document.querySelectorAll('.rx-med-row').forEach(row => {
            const name = row.querySelector('.rx-med-name').value;
            const instIndex = parseInt(row.querySelector('.rx-med-inst').value, 10);
            if (name) {
                medications.push({ name, dosage: '', instructions: RX_INSTRUCTIONS_AR[instIndex] });
            }
        });

        if (medications.length === 0 && !xrayType) {
            this.showToast(this.t('يرجى إضافة دواء واحد على الأقل أو اختيار نوع أشعة.', 'Please add at least one medication or select an X-ray type.'), 'warning');
            return;
        }

        let savedRxId = null;
        if (this.editingRxId) {
            const existing = await window.db.get('prescriptions', this.editingRxId);
            savedRxId = this.editingRxId;
            if (existing) {
                existing.date = date;
                existing.diagnosis = diagnosis;
                existing.medications = medications;
                existing.xrayType = xrayType;
                existing.doctorNotes = doctorNotes;
                existing.updatedBy = this.activeStaff?.name || null;
                existing.updatedAt = new Date().toISOString();
                await window.db.put('prescriptions', existing);
            }
            this.editingRxId = null;
        } else {
            const rxObj = {
                id: 'rx_' + Date.now(),
                patientId: this.activePatient.id,
                patientName: this.activePatient.name,
                patientAge: this.activePatient.age,
                patientGender: this.activePatient.gender,
                date,
                diagnosis,
                medications,
                xrayType,
                doctorNotes,
                createdBy: this.activeStaff?.name || null,
                createdAt: new Date().toISOString()
            };
            await window.db.put('prescriptions', rxObj);
            savedRxId = rxObj.id;
        }

        this.closeModal('prescriptionModal');
        this.showToast(this.t('تم حفظ الوصفة الطبية بنجاح.', 'Prescription saved successfully.'), 'success');
        await this.loadPatientPrescriptions();
        if (printAfter && savedRxId) await this.printPrescription(savedRxId);
    }

    // ==========================================
    // 9. APPOINTMENTS
    // ==========================================
    async loadAppointmentsList() {
        let appointments = await window.db.getAll('appointments');
        const patients = await window.db.getAll('patients');

        if (this.appointmentsView === 'calendar') this.renderAppointmentsCalendar();

        const tbody = document.getElementById('appointmentsTableBody');
        if (!tbody) return;

        // Once a booked slot's time is over — today or any earlier day — it
        // drops off the list instead of lingering there forever.
        const now = new Date();
        appointments = appointments.filter(a => {
            if (!a.time) return true;
            const start = new Date(`${this.normalizeStoredDate(a.date)}T${a.time}`);
            if (isNaN(start)) return true;
            const end = new Date(start.getTime() + this.getApptDuration(a) * 60000);
            return end > now;
        });

        if (appointments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state-row"><span class="empty-state-icon">📅</span><span class="empty-state-text">${this.t('لا توجد مواعيد مسجلة. انقر على "حجز موعد جديد".', 'No appointments found. Click "Book New Appointment".')}</span></td></tr>`;
            return;
        }

        appointments.sort((a,b) => (b.date + ' ' + (b.time||'')).localeCompare(a.date + ' ' + (a.time||'')));

        tbody.innerHTML = appointments.map(a => {
            const pat = patients.find(p => p.id === a.patientId);
            return `
            <tr>
                <td><strong>${this.formatDateAR(a.date)}</strong></td>
                <td><strong style="color:var(--primary); font-size:0.95rem;">${a.time || '--:--'}</strong></td>
                <td>${pat ? `<a href="javascript:void(0)" onclick="window.app.openPatientProfile('${pat.id}', { tab: 'teeth' })" style="color:var(--primary); font-weight:700;">${this.escapeHTML(pat.name)}</a>` : this.t('غير محدد', 'Not specified')}</td>
                <td>${this.escapeHTML(pat ? pat.phone : '--')}</td>
                <td>${this.escapeHTML(a.procedure) || this.t('كشف واستشارة', 'Checkup & Consultation')}</td>
                <td><span class="badge ${this.getApptBadgeClass(a.status)}">${this.getApptStatusLabel(a.status)}</span></td>
                <td>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <button class="btn btn-outline btn-sm icon-btn" title="${this.t('تعديل الموعد', 'Edit appointment')}" onclick="window.app.openEditAppointmentModal('${a.id}')">✏️</button>
                        ${pat ? `<button class="btn btn-outline btn-sm icon-btn" title="${this.t('فتح ملف المريض', 'Open patient file')}" onclick="window.app.openPatientProfile('${pat.id}', { tab: 'teeth' })">📂</button>` : ''}
                        <button class="btn btn-success btn-sm" onclick="window.app.quickChangeApptStatus('${a.id}', 'completed')">${this.t('إتمام ✅', 'Complete ✅')}</button>
                        ${this.buildRowActionsMenu([
                            { icon: '☑️', label: this.t('تأكيد', 'Confirm'), onclick: `window.app.quickChangeApptStatus('${a.id}', 'confirmed')` },
                            { icon: '🗑️', label: this.t('حذف', 'Delete'), onclick: `window.app.deleteAppointment('${a.id}')`, danger: true }
                        ])}
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    setAppointmentsView(view) {
        this.appointmentsView = view === 'calendar' ? 'calendar' : 'table';
        const tableView = document.getElementById('appointmentsTableView');
        const calendarView = document.getElementById('appointmentsCalendarView');
        const btnTable = document.getElementById('btnApptViewTable');
        const btnCalendar = document.getElementById('btnApptViewCalendar');
        const activeStyle = { background: 'white', color: 'var(--primary)', fontWeight: 'bold', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
        const inactiveStyle = { background: 'transparent', color: '#64748b', fontWeight: 'normal', boxShadow: 'none' };
        const applyStyle = (el, style) => { if (el) Object.assign(el.style, style); };

        if (this.appointmentsView === 'calendar') {
            if (tableView) tableView.style.display = 'none';
            if (calendarView) calendarView.style.display = 'block';
            applyStyle(btnCalendar, activeStyle);
            applyStyle(btnTable, inactiveStyle);
            if (!this.calendarWeekStart) this.calendarWeekStart = this.getWeekStart(this.todayISO());
            this.renderAppointmentsCalendar();
        } else {
            if (calendarView) calendarView.style.display = 'none';
            if (tableView) tableView.style.display = 'block';
            applyStyle(btnTable, activeStyle);
            applyStyle(btnCalendar, inactiveStyle);
        }
    }

    calendarPrevWeek() { this.shiftCalendarWeek(-7); }
    calendarNextWeek() { this.shiftCalendarWeek(7); }

    shiftCalendarWeek(days) {
        const d = new Date((this.calendarWeekStart || this.getWeekStart(this.todayISO())) + 'T00:00:00');
        d.setDate(d.getDate() + days);
        this.calendarWeekStart = this.dateToISO(d);
        this.renderAppointmentsCalendar();
    }

    calendarToday() {
        this.calendarWeekStart = this.getWeekStart(this.todayISO());
        this.renderAppointmentsCalendar();
    }

    // Keeps the calendar honest right after booking: a new/edited appointment
    // is otherwise invisible in Calendar view unless it happens to fall in
    // whatever week the calendar was last showing.
    jumpCalendarToDate(dateISO) {
        if (!dateISO) return;
        this.calendarWeekStart = this.getWeekStart(dateISO);
    }

    // ---- appointment time helpers (used by the calendar, booking form and drag/drop) ----
    getApptDuration(a) {
        return Number(a && a.duration) > 0 ? Number(a.duration) : 30;
    }

    timeToMinutes(t) {
        const [h, m] = String(t || '0:0').split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    }

    // First live appointment that overlaps [start, start + duration) on a day.
    findApptConflict(dateISO, startMin, durationMin, appointments, excludeId) {
        const end = startMin + durationMin;
        return appointments.find(a => {
            if (a.id === excludeId || a.status === 'cancelled' || !a.time) return false;
            if (this.normalizeStoredDate(a.date) !== dateISO) return false;
            const s = this.timeToMinutes(a.time);
            return startMin < s + this.getApptDuration(a) && s < end;
        }) || null;
    }

    async renderAppointmentsCalendar() {
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;
        if (!this.calendarWeekStart) this.calendarWeekStart = this.getWeekStart(this.todayISO());

        const appointments = await window.db.getAll('appointments');
        const patients = await window.db.getAll('patients');

        // Monday–Saturday only (Sunday is hidden).
        const weekStart = new Date(this.calendarWeekStart + 'T00:00:00');
        const days = [];
        for (let i = 0; i < 6; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        const todayStr = this.todayISO();

        const label = document.getElementById('calendarWeekLabel');
        if (label) {
            const fmt = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            label.textContent = `${fmt(days[0])} - ${fmt(days[5])}/${days[5].getFullYear()}`;
        }

        // 15-minute rows from 9:00. Appointments can be booked up to 6:00 pm;
        // the rows after that only exist so a long appointment can finish.
        const firstMinutes = 9 * 60, lastStart = 18 * 60, gridEnd = 19 * 60, step = 15;
        const rowCount = (gridEnd - firstMinutes) / step;
        this.calendarRowCount = rowCount;
        this.calendarFirstMinutes = firstMinutes;
        const dayNames = [
            this.t('الاثنين', 'Mon'), this.t('الثلاثاء', 'Tue'), this.t('الأربعاء', 'Wed'),
            this.t('الخميس', 'Thu'), this.t('الجمعة', 'Fri'), this.t('السبت', 'Sat')
        ];
        const to12h = (h, m) => `${(h % 12) || 12}:${String(m).padStart(2, '0')}`;
        const minutesTo12h = mins => to12h(Math.floor(mins / 60), mins % 60);

        grid.style.gridTemplateRows = `auto repeat(${rowCount}, 26px)`;
        let html = `<div class="calendar-cell calendar-day-header" style="grid-row:1; grid-column:1;"></div>`;
        days.forEach((d, i) => {
            const iso = this.dateToISO(d);
            html += `<div class="calendar-cell calendar-day-header day-color-${i} ${iso === todayStr ? 'is-today' : ''}" style="grid-row:1; grid-column:${i + 2};">${dayNames[i]}<br><small>${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}</small></div>`;
        });

        for (let r = 0; r < rowCount; r++) {
            const mins = firstMinutes + r * step;
            const hour = Math.floor(mins / 60), minute = mins % 60;
            const slotTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            const secondHalf = minute >= 30;
            const lineClass = minute === 45 ? '' : 'q-line';
            const closed = mins > lastStart;
            html += `<div class="calendar-cell calendar-time-label ${secondHalf ? 'is-half' : ''} ${minute % 30 ? 'is-quarter' : ''} ${lineClass}" style="grid-row:${r + 2}; grid-column:1;">${to12h(hour, minute)}</div>`;
            days.forEach((d, i) => {
                const iso = this.dateToISO(d);
                html += closed
                    ? `<div class="calendar-cell calendar-slot is-closed ${secondHalf ? 'is-half' : ''} ${lineClass}" style="grid-row:${r + 2}; grid-column:${i + 2};"></div>`
                    : `<div class="calendar-cell calendar-slot ${secondHalf ? 'is-half' : ''} ${lineClass}" style="grid-row:${r + 2}; grid-column:${i + 2};"
                            data-date="${iso}" data-time="${slotTime}"
                            onclick="window.app.openNewAppointmentModal('${iso}', '${slotTime}')"
                            ondragover="window.app.calDragOver(event)" ondragleave="window.app.calDragLeave(event)" ondrop="window.app.calDrop(event)"></div>`;
            });
        }

        // Appointment blocks sit on the grid over the cells, spanning as many
        // 15-minute rows as their duration.
        days.forEach((d, i) => {
            const iso = this.dateToISO(d);
            appointments.filter(a => this.normalizeStoredDate(a.date) === iso && a.time).forEach(a => {
                const start = this.timeToMinutes(a.time);
                if (start < firstMinutes || start >= gridEnd) return;
                const rowIdx = Math.floor((start - firstMinutes) / step);
                const span = Math.max(1, Math.min(Math.ceil(this.getApptDuration(a) / step), rowCount - rowIdx));
                const pat = patients.find(p => p.id === a.patientId);
                const name = pat ? this.escapeHTML(pat.name) : this.t('غير محدد', 'Not specified');
                const proc = this.escapeHTML(a.procedure || this.t('كشف واستشارة', 'Checkup & Consultation'));
                const kind = ['cancelled', 'completed', 'arrived'].includes(a.status) ? a.status : (a.isNewPatient ? 'newpatient' : (a.status || 'confirmed'));
                const timeLabel = span >= 2 ? `${minutesTo12h(start)}–${minutesTo12h(start + this.getApptDuration(a))}` : minutesTo12h(start);
                html += `<div class="calendar-appt-chip status-${kind}" style="grid-row:${rowIdx + 2} / span ${span}; grid-column:${i + 2};"
                        data-row="${rowIdx + 2}" data-span="${span}" draggable="true"
                        ondragstart="window.app.calDragStart(event, '${a.id}')" ondragend="window.app.calDragEnd(event)"
                        onclick="event.stopPropagation()" title="${proc}">
                        <span class="chip-actions">
                            <button type="button" title="${this.t('تعديل الموعد', 'Edit appointment')}" onclick="event.stopPropagation(); window.app.openEditAppointmentModal('${a.id}')">✏️</button>
                            ${pat ? `<button type="button" title="${this.t('فتح ملف المريض', 'Open patient file')}" onclick="event.stopPropagation(); window.app.openPatientProfile('${pat.id}', { tab: 'teeth' })">📂</button>` : ''}
                        </span>
                        <strong>${timeLabel}</strong>
                        ${pat ? `<a class="chip-name" href="javascript:void(0)" onclick="event.stopPropagation(); window.app.openPatientProfile('${pat.id}', { tab: 'teeth' })">${name}</a>` : name}${span >= 3 ? `<br>${proc}` : ''}
                        <span class="chip-resize" title="${this.t('اسحب لتغيير مدة الموعد', 'Drag to change the appointment length')}" onmousedown="window.app.startChipResize(event, '${a.id}')"></span>
                    </div>`;
            });
        });
        grid.innerHTML = html;

        const legend = document.getElementById('calendarLegend');
        if (legend) {
            legend.innerHTML = `
                <span class="lg-confirmed">${this.t('مؤكد', 'Confirmed')}</span>
                <span class="lg-pending">${this.t('قيد الانتظار', 'Pending')}</span>
                <span class="lg-newpatient">${this.t('مريض جديد', 'New Patient')}</span>
                <span class="lg-arrived">${this.t('وصل', 'Arrived')}</span>
                <span class="lg-completed">${this.t('مكتمل', 'Completed')}</span>
                <span class="lg-cancelled">${this.t('ملغي', 'Cancelled')}</span>
                <small style="color:var(--text-muted); font-weight:600;">${this.t('اسحب الموعد لنقله، واسحب حافته السفلية لتغيير مدته', 'Drag an appointment to move it; drag its bottom edge to change its length')}</small>`;
        }
    }

    // ---- drag & drop: move an appointment to another day/time ----
    calDragStart(event, id) {
        this.calDragId = id;
        event.dataTransfer.setData('text/plain', id);
        event.dataTransfer.effectAllowed = 'move';
        const chip = event.currentTarget;
        // Let the pointer reach the cells underneath while dragging.
        setTimeout(() => {
            chip.classList.add('dragging');
            document.getElementById('calendarGrid')?.classList.add('is-dragging');
        }, 0);
    }

    calDragEnd(event) {
        this.calDragId = null;
        event.currentTarget.classList.remove('dragging');
        const grid = document.getElementById('calendarGrid');
        if (grid) {
            grid.classList.remove('is-dragging');
            grid.querySelectorAll('.drop-target').forEach(c => c.classList.remove('drop-target'));
        }
    }

    calDragOver(event) {
        if (!this.calDragId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('drop-target');
    }

    calDragLeave(event) {
        event.currentTarget.classList.remove('drop-target');
    }

    async calDrop(event) {
        event.preventDefault();
        const cell = event.currentTarget;
        cell.classList.remove('drop-target');
        const id = this.calDragId;
        this.calDragId = null;
        if (!id) return;
        const appt = await window.db.get('appointments', id);
        if (!appt) return;
        const date = cell.dataset.date;
        const time = cell.dataset.time;
        if (this.normalizeStoredDate(appt.date) === date && appt.time === time) { this.renderAppointmentsCalendar(); return; }

        const appointments = await window.db.getAll('appointments');
        if (this.findApptConflict(date, this.timeToMinutes(time), this.getApptDuration(appt), appointments, id)) {
            this.showToast(this.t('لا يمكن النقل: يتعارض مع موعد آخر في هذا الوقت.', 'Cannot move here: it overlaps another appointment.'), 'warning');
            this.renderAppointmentsCalendar();
            return;
        }
        appt.date = date;
        appt.time = time;
        appt.updatedAt = new Date().toISOString();
        await window.db.put('appointments', appt);
        this.showToast(this.t('تم نقل الموعد.', 'Appointment moved.'), 'success');
        await this.renderAppointmentsCalendar();
        await this.refreshDashboard();
        if (this.activePatient) this.scheduleWorkspaceRefresh();
    }

    // ---- resize: drag the bottom edge to change the appointment length ----
    startChipResize(event, id) {
        event.preventDefault();
        event.stopPropagation();
        const chip = event.target.closest('.calendar-appt-chip');
        const grid = document.getElementById('calendarGrid');
        const sample = grid.querySelector('.calendar-slot');
        if (!chip || !sample) return;
        chip.draggable = false;
        const rowHeight = sample.getBoundingClientRect().height;
        const startY = event.clientY;
        const startRow = parseInt(chip.dataset.row, 10);
        const startSpan = parseInt(chip.dataset.span, 10);
        const maxSpan = this.calendarRowCount - (startRow - 2);
        let span = startSpan;
        chip.classList.add('resizing');

        const onMove = ev => {
            span = Math.max(1, Math.min(maxSpan, startSpan + Math.round((ev.clientY - startY) / rowHeight)));
            chip.style.gridRow = `${startRow} / span ${span}`;
        };
        const onUp = async () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            chip.classList.remove('resizing');
            chip.draggable = true;
            if (span !== startSpan) await this.setApptDuration(id, span * 15);
            else this.renderAppointmentsCalendar();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    async setApptDuration(id, minutes) {
        const appt = await window.db.get('appointments', id);
        if (!appt) return;
        const appointments = await window.db.getAll('appointments');
        const date = this.normalizeStoredDate(appt.date);
        const start = this.timeToMinutes(appt.time);
        // Never grow into the next appointment of that day.
        const nextStarts = appointments
            .filter(a => a.id !== id && a.status !== 'cancelled' && a.time && this.normalizeStoredDate(a.date) === date && this.timeToMinutes(a.time) >= start + 1)
            .map(a => this.timeToMinutes(a.time));
        const limit = nextStarts.length ? Math.min(...nextStarts) - start : Infinity;
        const finalMinutes = Math.max(15, Math.min(minutes, limit));
        if (finalMinutes < minutes) {
            this.showToast(this.t('تم تقصير المدة كي لا يتعارض مع الموعد التالي.', 'Length limited so it does not overlap the next appointment.'), 'info');
        }
        appt.duration = finalMinutes;
        appt.updatedAt = new Date().toISOString();
        await window.db.put('appointments', appt);
        await this.renderAppointmentsCalendar();
        await this.refreshDashboard();
    }

    // "New Patient" checkbox in the booking form: lets the doctor type just a
    // name for someone phoning in; a patient file with the next sequential
    // code is created on save and can be completed later.
    toggleApptNewPatient() {
        const checked = document.getElementById('apptNewPatientCheck').checked;
        const select = document.getElementById('apptPatientSelect');
        const nameInput = document.getElementById('apptNewPatientName');
        const phoneInput = document.getElementById('apptNewPatientPhone');
        const fieldsWrap = document.getElementById('apptNewPatientFields');
        select.disabled = checked;
        select.required = !checked;
        if (fieldsWrap) fieldsWrap.style.display = checked ? 'flex' : 'none';
        if (checked) { select.value = ''; nameInput.focus(); } else { nameInput.value = ''; if (phoneInput) phoneInput.value = ''; }
    }

    async openNewAppointmentModal(prefillDate = null, prefillTime = null) {
        this.editingAppointmentId = null;
        const npCheck = document.getElementById('apptNewPatientCheck');
        if (npCheck) {
            npCheck.checked = false;
            document.getElementById('apptNewPatientWrap').style.display = 'flex';
            this.toggleApptNewPatient();
        }
        const phoneInput0 = document.getElementById('apptNewPatientPhone');
        if (phoneInput0) phoneInput0.value = '';
        const modalTitle = document.getElementById('appointmentModalTitle');
        if (modalTitle) modalTitle.textContent = this.t('📅 حجز موعد جديد', '📅 Book New Appointment');
        const submitBtn = document.getElementById('apptSubmitBtn');
        if (submitBtn) submitBtn.textContent = this.t('📅 تأكيد الحجز', '📅 Confirm Booking');

        const patients = await window.db.getAll('patients');
        const select = document.getElementById('apptPatientSelect');
        if (select) {
            select.disabled = false;
            select.innerHTML = `<option value="">${this.t('اختر المريض...', 'Select a patient...')}</option>` +
                patients.filter(p => !p.isArchived).map(p => `<option value="${p.id}">${this.escapeHTML(p.name)} (${this.escapeHTML(p.patientCode)})</option>`).join('');

            if (this.activePatient) {
                select.value = this.activePatient.id;
            }
        }

        this.setDateInput('apptDate', prefillDate || this.todayISO());
        document.getElementById('apptTime').value = prefillTime || '16:00';
        document.getElementById('apptDuration').value = '30';
        document.getElementById('apptProcedure').value = '';
        document.getElementById('apptNotes').value = '';
        const statusSelect = document.getElementById('apptStatus');
        if (statusSelect) statusSelect.value = 'confirmed';
        const reminderCheck0 = document.getElementById('apptReminderCheck');
        if (reminderCheck0) reminderCheck0.checked = false;

        const conflictDiv = document.getElementById('apptConflictWarning');
        if (conflictDiv) conflictDiv.style.display = 'none';

        const searchInput = document.getElementById('apptPatientSearch');
        if (searchInput) searchInput.value = '';
        const phoneSearch = document.getElementById('apptPhoneSearch');
        if (phoneSearch) phoneSearch.value = '';

        this.openModal('appointmentModal');
    }

    // Type-to-filter for the "Book New Appointment" patient dropdown.
    async filterApptPatientOptions() {
        const q = String(document.getElementById('apptPatientSearch')?.value || '').trim().toLowerCase();
        const digits = s => String(s || '').replace(/D/g, '');
        const phoneQ = digits(document.getElementById('apptPhoneSearch')?.value);
        const select = document.getElementById('apptPatientSelect');
        if (!select) return;
        const phones = new Map((await window.db.getAll('patients')).map(p => [p.id, digits(p.phone)]));        let firstMatch = null;
        Array.from(select.options).forEach(o => {
            if (!o.value) return; // keep the "Select a patient..." placeholder always visible
            const show = (!q || o.textContent.toLowerCase().includes(q)) && (!phoneQ || (phones.get(o.value) || '').includes(phoneQ));
            o.hidden = !show;
            if (show && !firstMatch) firstMatch = o;
        });
        if ((q || phoneQ) && firstMatch) select.value = firstMatch.value;
    }

    async openEditAppointmentModal(apptId) {
        this.editingAppointmentId = apptId;
        const appt = await window.db.get('appointments', apptId);
        if (!appt) return;

        const npCheck = document.getElementById('apptNewPatientCheck');
        if (npCheck) {
            npCheck.checked = false;
            this.toggleApptNewPatient();
            document.getElementById('apptNewPatientWrap').style.display = 'none';
        }

        const modalTitle = document.getElementById('appointmentModalTitle');
        if (modalTitle) modalTitle.textContent = this.t('✏️ تعديل موعد المريض', "✏️ Edit Patient's Appointment");
        const submitBtn = document.getElementById('apptSubmitBtn');
        if (submitBtn) submitBtn.textContent = this.t('💾 حفظ التعديلات', '💾 Save Changes');

        const patients = await window.db.getAll('patients');
        const select = document.getElementById('apptPatientSelect');
        if (select) {
            select.innerHTML = `<option value="">${this.t('اختر المريض...', 'Select a patient...')}</option>` +
                patients.filter(p => !p.isArchived).map(p => `<option value="${p.id}">${this.escapeHTML(p.name)} (${this.escapeHTML(p.patientCode)})</option>`).join('');
            select.value = appt.patientId;
        }
        const searchInput = document.getElementById('apptPatientSearch');
        if (searchInput) searchInput.value = '';
        const phoneSearch = document.getElementById('apptPhoneSearch');
        if (phoneSearch) phoneSearch.value = '';

        this.setDateInput('apptDate', appt.date || '');
        document.getElementById('apptTime').value = appt.time || '';
        const durSelect = document.getElementById('apptDuration');
        const dur = String(this.getApptDuration(appt));
        if (!Array.from(durSelect.options).some(o => o.value === dur)) durSelect.add(new Option(`${dur} min`, dur));
        durSelect.value = dur;
        document.getElementById('apptProcedure').value = appt.procedure || '';
        document.getElementById('apptNotes').value = appt.notes || '';
        const statusSelect = document.getElementById('apptStatus');
        if (statusSelect) statusSelect.value = appt.status || 'confirmed';
        const reminderCheck = document.getElementById('apptReminderCheck');
        if (reminderCheck) reminderCheck.checked = !!appt.reminderEnabled;

        await this.checkAppointmentConflict();
        this.openModal('appointmentModal');
    }

    async checkAppointmentConflict() {
        const date = this.getDateInputISO('apptDate');
        const time = document.getElementById('apptTime')?.value;
        const conflictDiv = document.getElementById('apptConflictWarning');
        if (!conflictDiv) return;

        if (!date || !time) {
            conflictDiv.style.display = 'none';
            return;
        }

        const appointments = await window.db.getAll('appointments');
        const patients = await window.db.getAll('patients');

        const duration = Number(document.getElementById('apptDuration')?.value) || 30;
        const conflicting = this.findApptConflict(date, this.timeToMinutes(time), duration, appointments, this.editingAppointmentId);

        if (conflicting) {
            const pat = patients.find(p => p.id === conflicting.patientId);
            const patName = pat ? pat.name : this.t('مريض آخر', 'another patient');
            conflictDiv.innerHTML = `⚠️ <strong>${this.t('تنبيه تضارب مواعيد:', 'Scheduling conflict:')}</strong> ${this.t('يتداخل مع موعد آخر', 'This overlaps another appointment')} (${conflicting.time}) ${this.t('للمريض', 'for patient')} <strong>${this.escapeHTML(patName)}</strong> (${this.escapeHTML(conflicting.procedure) || this.t('كشف واستشارة', 'Checkup & Consultation')}).`;
            conflictDiv.style.display = 'block';
        } else {
            conflictDiv.style.display = 'none';
        }
    }

    async saveAppointment() {
        let patientId = document.getElementById('apptPatientSelect').value;
        const isNewPatient = !this.editingAppointmentId && document.getElementById('apptNewPatientCheck')?.checked;
        const newPatientName = document.getElementById('apptNewPatientName')?.value.trim() || '';
        const newPatientPhone = document.getElementById('apptNewPatientPhone')?.value.trim() || '';
        if (isNewPatient && !newPatientName) {
            this.showToast(this.t('يرجى كتابة اسم المريض الجديد.', "Please type the new patient's name."), 'warning');
            document.getElementById('apptNewPatientName').focus();
            return;
        }
        const date = this.validateDateInput('apptDate', true);
        if (date === null) return;
        const time = document.getElementById('apptTime').value;
        const procedure = document.getElementById('apptProcedure').value.trim();
        const notes = document.getElementById('apptNotes').value.trim();
        const statusSelect = document.getElementById('apptStatus');
        const status = statusSelect ? statusSelect.value : 'confirmed';
        const reminderEnabled = !!document.getElementById('apptReminderCheck')?.checked;

        if ((!patientId && !isNewPatient) || !date || !time) {
            this.showToast(this.t('يرجى تحديد المريض والتاريخ والوقت.', 'Please select the patient, date, and time.'), 'warning');
            return;
        }
        const duration = Number(document.getElementById('apptDuration')?.value) || 30;
        const appointments = await window.db.getAll('appointments');
        const conflict = this.findApptConflict(date, this.timeToMinutes(time), duration, appointments, this.editingAppointmentId);
        if (conflict) {
            this.showToast(this.t(`لا يمكن الحجز: الوقت ${time} يتداخل مع موعد آخر بتاريخ ${this.formatDateAR(date)}.`, `Cannot book: ${time} overlaps another appointment on ${this.formatDateAR(date)}.`), 'warning');
            return;
        }

        if (isNewPatient) {
            const newPatient = {
                id: 'pat_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                patientCode: await window.db.getNextPatientCode(),
                name: newPatientName,
                age: '', dob: '', gender: '', phone: newPatientPhone, altPhone: '', address: '',
                emergencyContact: '', referredBy: '', notes: '',
                medicalAlerts: {}, allergyDetails: '',
                teethRecord: {}, treatmentPlans: [], visits: [],
                isArchived: false,
                createdFromAppointment: true,
                createdBy: this.activeStaff?.name || null,
                createdAt: new Date().toISOString()
            };
            await window.db.put('patients', newPatient);
            patientId = newPatient.id;
            await this.loadPatientsList();
        }

        if (this.editingAppointmentId) {
            const apptObj = await window.db.get('appointments', this.editingAppointmentId);
            if (apptObj) {
                apptObj.patientId = patientId;
                apptObj.date = date;
                apptObj.time = time;
                apptObj.duration = duration;
                apptObj.procedure = procedure;
                apptObj.notes = notes;
                apptObj.status = status;
                apptObj.reminderEnabled = reminderEnabled;
                if (status === 'arrived' && !apptObj.arrivedAt) apptObj.arrivedAt = new Date().toISOString();
                apptObj.updatedAt = new Date().toISOString();
                await window.db.put('appointments', apptObj);
                this.showToast(this.t('تم تعديل وقت وتفاصيل الموعد بنجاح 🕒', 'Appointment time and details updated successfully 🕒'), 'success');
            }
        } else {
            const apptObj = {
                id: 'apt_' + Date.now(),
                patientId,
                date,
                time,
                duration,
                procedure,
                notes,
                isNewPatient: !!isNewPatient,
                createdBy: this.activeStaff?.name || null,
                status: status || 'confirmed',
                reminderEnabled,
                createdAt: new Date().toISOString()
            };
            await window.db.put('appointments', apptObj);
            this.showToast(this.t('تم حجز الموعد بنجاح 📅', 'Appointment booked successfully 📅'), 'success');
        }

        this.jumpCalendarToDate(date);
        this.closeModal('appointmentModal');
        await this.loadAppointmentsList();
        await this.refreshDashboard();
        if (this.activePatient) this.scheduleWorkspaceRefresh();
    }

    async quickChangeApptStatus(apptId, status) {
        const appt = await window.db.get('appointments', apptId);
        if (appt) {
            appt.status = status;
            if (status === 'arrived' && !appt.arrivedAt) appt.arrivedAt = new Date().toISOString();
            await window.db.put('appointments', appt);
            this.showToast(this.t('تم تحديث حالة الموعد.', 'Appointment status updated.'), 'info');
            await this.loadAppointmentsList();
            await this.refreshDashboard();
            if (this.activePatient) this.scheduleWorkspaceRefresh();
        }
    }

    async deleteAppointment(apptId) {
        if (!confirm(this.t('هل أنت متأكد من حذف هذا الموعد؟', 'Are you sure you want to delete this appointment?'))) return;
        await window.db.delete('appointments', apptId);
        this.showToast(this.t('تم حذف الموعد.', 'Appointment deleted.'), 'info');
        await this.loadAppointmentsList();
        await this.refreshDashboard();
        if (this.activePatient) this.scheduleWorkspaceRefresh();
    }

    getApptBadgeClass(status) {
        if (status === 'arrived') return 'badge-cyan';
        if (status === 'confirmed') return 'badge-blue';
        if (status === 'completed') return 'badge-green';
        if (status === 'cancelled') return 'badge-rose';
        return 'badge-amber';
    }

    getApptStatusLabel(status) {
        if (status === 'arrived') return this.t('وصل', 'Arrived');
        if (status === 'confirmed') return this.t('مؤكد', 'Confirmed');
        if (status === 'completed') return this.t('مكتمل ✅', 'Completed ✅');
        if (status === 'cancelled') return this.t('ملغي ❌', 'Cancelled ❌');
        return this.t('قيد الانتظار', 'Pending');
    }

    // ==========================================
    // 10. FINANCIAL REPORTS
    // ==========================================
    async loadFinancials() {
        const today = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        const fromInput = document.getElementById('finReportFrom');
        const toInput = document.getElementById('finReportTo');
        if (fromInput && !fromInput.value) this.setDateInput('finReportFrom', firstDayOfMonth);
        if (toInput && !toInput.value) this.setDateInput('finReportTo', today);

        const regFromInput = document.getElementById('regReportFrom');
        const regToInput = document.getElementById('regReportTo');
        if (regFromInput && !regFromInput.value) this.setDateInput('regReportFrom', firstDayOfMonth);
        if (regToInput && !regToInput.value) this.setDateInput('regReportTo', today);

        const procFromInput = document.getElementById('procReportFrom');
        const procToInput = document.getElementById('procReportTo');
        if (procFromInput && !procFromInput.value) this.setDateInput('procReportFrom', firstDayOfMonth);
        if (procToInput && !procToInput.value) this.setDateInput('procReportTo', today);

        const ledgerFromInput = document.getElementById('ledgerReportFrom');
        const ledgerToInput = document.getElementById('ledgerReportTo');
        if (ledgerFromInput && !ledgerFromInput.value) this.setDateInput('ledgerReportFrom', firstDayOfMonth);
        if (ledgerToInput && !ledgerToInput.value) this.setDateInput('ledgerReportTo', today);

        await this.runFinancialReport();
        await this.runPatientRegistrationsReport();
        await this.runProcedureTypeReport();
        await this.runDailyLedgerReport();
    }

    async runFinancialReport() {
        const fromDate = this.validateDateInput('finReportFrom', false);
        if (fromDate === null) return;
        const toDate = this.validateDateInput('finReportTo', false);
        if (toDate === null) return;

        const payments = await window.db.getAll('payments');
        const invoices = await window.db.getAll('invoices');

        const periodPayments = payments.filter(p => (!fromDate || p.date >= fromDate) && (!toDate || p.date <= toDate));
        const periodInvoices = invoices.filter(i => (!fromDate || i.date >= fromDate) && (!toDate || i.date <= toDate));

        const expenses = await window.db.getAll('expenses');
        const periodExpenses = expenses.filter(e => (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate));

        const totalRevenue = periodPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const totalBilled = periodInvoices.reduce((s, i) => s + (parseFloat(i.netTotal) || 0), 0);
        const totalDiscounts = periodInvoices.reduce((s, i) => s + (parseFloat(i.discount) || 0), 0);
        const totalExpenses = periodExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const netIncome = totalRevenue - totalExpenses;

        document.getElementById('repTotalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
        document.getElementById('repTotalBilled').textContent = `$${totalBilled.toFixed(2)}`;
        document.getElementById('repTotalDiscounts').textContent = `$${totalDiscounts.toFixed(2)}`;
        const expensesEl = document.getElementById('repTotalExpenses');
        if (expensesEl) expensesEl.textContent = `$${totalExpenses.toFixed(2)}`;
        const netEl = document.getElementById('repNetIncome');
        if (netEl) {
            netEl.textContent = `$${netIncome.toFixed(2)}`;
            netEl.style.color = netIncome < 0 ? 'var(--danger)' : '';
        }

        // Compared against the immediately preceding period of the same
        // length (e.g. "this month" vs "last month") — skipped when the range
        // is open-ended ("from the beginning"), which has no equal previous span.
        const revTrendEl = document.getElementById('repTotalRevenueTrend');
        const netTrendEl = document.getElementById('repNetIncomeTrend');
        if (fromDate && toDate) {
            const fromD = new Date(`${fromDate}T00:00:00`), toD = new Date(`${toDate}T00:00:00`);
            const lengthDays = Math.round((toD - fromD) / 86400000) + 1;
            const prevTo = new Date(fromD); prevTo.setDate(prevTo.getDate() - 1);
            const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (lengthDays - 1));
            const prevFromStr = this.dateToISO(prevFrom), prevToStr = this.dateToISO(prevTo);
            const prevPayments = payments.filter(p => p.date >= prevFromStr && p.date <= prevToStr);
            const prevExpenses = expenses.filter(e => e.date >= prevFromStr && e.date <= prevToStr);
            const prevRevenue = prevPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
            const prevNet = prevRevenue - prevExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            this.renderKpiTrend('repTotalRevenueTrend', totalRevenue, prevRevenue, this.t('عن الفترة السابقة', 'vs previous period'), true);
            this.renderKpiTrend('repNetIncomeTrend', netIncome, prevNet, this.t('عن الفترة السابقة', 'vs previous period'), true);
        } else {
            if (revTrendEl) revTrendEl.textContent = '';
            if (netTrendEl) netTrendEl.textContent = '';
        }
        // Credit on Account is a balance-sheet figure (what's owed back to
        // patients right now), not a period total, so it uses all invoices/payments.
        const creditEl = document.getElementById('repTotalCredit');
        if (creditEl) { const { totals } = await this.computeCreditReport({ skipSearch: true }); creditEl.textContent = `$${totals.credit.toFixed(2)}`; }

        await this.renderMonthlyRevenueChart();

        const tbody = document.getElementById('financialLedgerTableBody');
        if (tbody) {
            if (periodPayments.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">${this.t('لا توجد حركات مالية مسجلة خلال الفترة.', 'No financial transactions recorded during this period.')}</td></tr>`;
            } else {
                tbody.innerHTML = periodPayments.map(p => `
                    <tr>
                        <td><strong>${p.receiptNumber || 'REC'}</strong></td>
                        <td>${this.formatDateAR(p.date)}</td>
                        <td>${this.escapeHTML(p.patientName)}</td>
                        <td><strong style="color:var(--success);">$${p.amount.toFixed(2)}</strong></td>
                        <td>${p.method === 'cash' ? this.t('نقدي', 'Cash') : (p.method === 'card' ? this.t('بطاقة', 'Card') : this.t('تحويل', 'Transfer'))}</td>
                        <td>${this.escapeHTML(p.notes || '--')}</td>
                    </tr>
                `).join('');
            }
        }

        this.renderExpensesTable(periodExpenses);
    }

    renderExpensesTable(expenses) {
        // Keep the full period list so the search box can filter it live.
        if (expenses) this.expensesPeriodList = expenses;
        const tbody = document.getElementById('expensesTableBody');
        if (!tbody) return;
        const q = (document.getElementById('expensesSearchInput')?.value || '').trim().toLowerCase();
        const list = (this.expensesPeriodList || []).filter(e =>
            !q || String(e.description || '').toLowerCase().includes(q) || String(e.notes || '').toLowerCase().includes(q));
        if (list.length === 0) {
            const msg = q ? this.t('لا توجد مصاريف مطابقة للبحث.', 'No expenses match your search.') : this.t('لا توجد مصاريف مسجلة بعد.', 'No expenses recorded yet.');
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">${msg}</td></tr>`;
            return;
        }
        const sorted = [...list].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        tbody.innerHTML = sorted.map(e => `
            <tr>
                <td>${this.formatDateAR(e.date)}</td>
                <td>${this.escapeHTML(e.description)}</td>
                <td><strong style="color:var(--danger);">$${(parseFloat(e.amount) || 0).toFixed(2)}</strong></td>
                <td>${e.notes ? this.escapeHTML(e.notes) : '--'}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-outline btn-sm" onclick="window.app.openEditExpenseModal('${e.id}')">✏️ ${this.t('تعديل', 'Edit')}</button>
                        <button class="btn btn-danger btn-sm" onclick="window.app.deleteExpense('${e.id}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    openNewExpenseModal() {
        this.editingExpenseId = null;
        document.getElementById('expenseForm').reset();
        this.setDateInput('expenseDate', this.todayISO());
        const title = document.getElementById('expenseModalTitle');
        if (title) title.textContent = this.t('💸 إضافة مصروف', '💸 Add Expense');
        this.openModal('expenseModal');
    }

    async openEditExpenseModal(id) {
        const exp = await window.db.get('expenses', id);
        if (!exp) return;
        this.editingExpenseId = id;
        document.getElementById('expenseDescription').value = exp.description || '';
        document.getElementById('expenseAmount').value = exp.amount;
        this.setDateInput('expenseDate', exp.date);
        document.getElementById('expenseNotes').value = exp.notes || '';
        const title = document.getElementById('expenseModalTitle');
        if (title) title.textContent = this.t('✏️ تعديل المصروف', '✏️ Edit Expense');
        this.openModal('expenseModal');
    }

    async saveExpense() {
        const description = document.getElementById('expenseDescription').value.trim();
        const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
        const date = this.validateDateInput('expenseDate', true);
        if (date === null) return;
        const notes = document.getElementById('expenseNotes').value.trim();

        if (!description || amount <= 0) {
            this.showToast(this.t('يرجى إدخال وصف ومبلغ صحيح للمصروف.', 'Please enter a description and a valid amount for the expense.'), 'warning');
            return;
        }

        const existing = this.editingExpenseId ? await window.db.get('expenses', this.editingExpenseId) : null;
        if (existing) {
            Object.assign(existing, { description, amount, date, notes, updatedBy: this.activeStaff?.name || null, updatedAt: new Date().toISOString() });
            await window.db.put('expenses', existing);
        } else {
            await window.db.put('expenses', {
                id: 'exp_' + Date.now(),
                description, amount, date, notes,
                createdBy: this.activeStaff?.name || null,
                createdAt: new Date().toISOString()
            });
        }
        this.editingExpenseId = null;

        this.closeModal('expenseModal');
        this.showToast(this.t('تم حفظ المصروف بنجاح.', 'Expense saved successfully.'), 'success');
        await this.runFinancialReport();
    }

    async deleteExpense(id) {
        if (!confirm(this.t('حذف هذا المصروف؟', 'Delete this expense?'))) return;
        await window.db.delete('expenses', id);
        this.showToast(this.t('تم حذف المصروف.', 'Expense deleted.'), 'info');
        await this.runFinancialReport();
    }

    // Shared Excel writer for the report exports: optional summary lines on
    // top, then a header row + data, in the clinic's standard look (font 16,
    // borders on every cell, dark-grey bold header, centred).
    // extraSheets: more sheets of the same shape {sheetName, summary, headers, rows, widths}.
    async downloadReportExcel({ sheetName, summary = [], headers, rows, widths, filename, extraSheets = [] }) {
        if (typeof ExcelJS === 'undefined') {
            this.showToast(this.t('تعذر تحميل مكتبة Excel. تأكد من الاتصال بالإنترنت وحاول مجدداً.', 'Could not load the Excel library. Check your internet connection and try again.'), 'error');
            return;
        }
        const workbook = new ExcelJS.Workbook();
        const thin = { style: 'thin' };
        // Excel sheet names ban * ? : \ / [ ] and must be unique and ≤31 chars —
        // a label like "Procedures / Treatment Plans" would otherwise make
        // ExcelJS throw and the export silently do nothing.
        const usedSheetNames = new Set();
        const safeSheetName = label => {
            let name = String(label).replace(/[*?:\\/[\]]/g, '-').slice(0, 31).trim() || 'Sheet';
            let i = 2;
            while (usedSheetNames.has(name)) { const suffix = ` (${i++})`; name = name.slice(0, 31 - suffix.length) + suffix; }
            usedSheetNames.add(name);
            return name;
        };
        [{ sheetName, summary, headers, rows, widths }, ...extraSheets].forEach(def => {
            const sheet = workbook.addWorksheet(safeSheetName(def.sheetName));
            (def.summary || []).forEach(line => sheet.addRow(line));
            if ((def.summary || []).length) sheet.addRow([]);
            const headerRowIdx = sheet.rowCount + 1;
            sheet.addRow(def.headers);
            def.rows.forEach(r => sheet.addRow(r));
            sheet.columns = def.widths.map(w => ({ width: w }));
            sheet.eachRow({ includeEmpty: false }, row => {
                row.eachCell({ includeEmpty: false }, cell => {
                    cell.font = { size: 16 };
                    cell.border = { top: thin, left: thin, bottom: thin, right: thin };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
            });
            sheet.getRow(headerRowIdx).eachCell({ includeEmpty: false }, cell => {
                cell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF595959' } };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.showToast(this.t('تم تصدير التقرير بنجاح.', 'Report exported successfully.'), 'success');
    }

    async exportFinancialReportToExcel() {
        const fromDate = this.validateDateInput('finReportFrom', false);
        if (fromDate === null) return;
        const toDate = this.validateDateInput('finReportTo', false);
        if (toDate === null) return;
        const [payments, invoices, expenses] = await Promise.all([window.db.getAll('payments'), window.db.getAll('invoices'), window.db.getAll('expenses')]);
        const inRange = x => (!fromDate || x.date >= fromDate) && (!toDate || x.date <= toDate);
        const pPay = payments.filter(inRange), pInv = invoices.filter(inRange), pExp = expenses.filter(inRange);
        const sum = (list, f) => list.reduce((s, x) => s + (parseFloat(f(x)) || 0), 0);
        const revenue = sum(pPay, p => p.amount), expensesTotal = sum(pExp, e => e.amount);
        const methodLabel = m => m === 'cash' ? this.t('نقدي', 'Cash') : (m === 'card' ? this.t('بطاقة', 'Card') : this.t('تحويل', 'Transfer'));
        await this.downloadReportExcel({
            sheetName: this.t('التقرير المالي', 'Financial Report'),
            summary: [
                [this.t('إجمالي المقبوضات', 'Total Receipts'), revenue],
                [this.t('إجمالي الفواتير الصادرة', 'Total Billed'), sum(pInv, i => i.netTotal)],
                [this.t('إجمالي الخصومات', 'Total Discounts'), sum(pInv, i => i.discount)],
                [this.t('إجمالي المصاريف', 'Total Expenses'), expensesTotal],
                [this.t('صافي الدخل', 'Net Income'), revenue - expensesTotal]
            ],
            headers: [this.t('رقم الإيصال', 'Receipt No.'), this.t('التاريخ', 'Date'), this.t('اسم المريض', 'Patient Name'), this.t('المبلغ المقبوض', 'Amount Received'), this.t('طريقة الدفع', 'Payment Method'), this.t('ملاحظات', 'Notes')],
            rows: pPay.map(p => [p.receiptNumber || 'REC', this.formatDateAR(p.date), p.patientName || '--', parseFloat(p.amount) || 0, methodLabel(p.method), p.notes || '--']),
            widths: [26, 16, 26, 20, 20, 26],
            filename: 'Financial_Report'
        });
    }

    async exportExpensesToExcel() {
        const fromDate = this.validateDateInput('finReportFrom', false);
        if (fromDate === null) return;
        const toDate = this.validateDateInput('finReportTo', false);
        if (toDate === null) return;
        const q = (document.getElementById('expensesSearchInput')?.value || '').trim().toLowerCase();
        const list = (await window.db.getAll('expenses'))
            .filter(e => (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate))
            .filter(e => !q || String(e.description || '').toLowerCase().includes(q) || String(e.notes || '').toLowerCase().includes(q))
            .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        const total = list.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        await this.downloadReportExcel({
            sheetName: this.t('المصاريف', 'Expenses'),
            summary: [[this.t('إجمالي المصاريف', 'Total Expenses'), total]],
            headers: [this.t('التاريخ', 'Date'), this.t('الوصف', 'Description'), this.t('المبلغ', 'Amount'), this.t('ملاحظات', 'Notes')],
            rows: list.map(e => [this.formatDateAR(e.date), e.description || '--', parseFloat(e.amount) || 0, e.notes || '--']),
            widths: [26, 34, 16, 34],
            filename: 'Expenses'
        });
    }

    async exportPatientRegistrationsToExcel() {
        const fromDate = this.validateDateInput('regReportFrom', false);
        if (fromDate === null) return;
        const toDate = this.validateDateInput('regReportTo', false);
        if (toDate === null) return;
        const matches = await this.getPatientRegistrationsInRange(fromDate, toDate);
        await this.downloadReportExcel({
            sheetName: this.t('تسجيل المرضى الجدد', 'New Patients'),
            summary: [[this.t('عدد المرضى الجدد', 'New Patients'), matches.length]],
            headers: [this.t('رقم الملف', 'File No.'), this.t('اسم المريض', 'Patient Name'), this.t('تاريخ التسجيل', 'Registration Date'), this.t('رقم الهاتف', 'Phone'), this.t('وصل عن طريق', 'Referred By')],
            rows: matches.map(p => [p.patientCode, p.name, this.formatDateAR(this.normalizeStoredDate(p.createdAt || '')), p.phone || '--', p.referredBy || '--']),
            widths: [20, 30, 22, 22, 26],
            filename: 'New_Patient_Registrations'
        });
    }

    async printFinancialReport() {
        const fromDate = this.validateDateInput('finReportFrom', false);
        if (fromDate === null) return;
        const toDate = this.validateDateInput('finReportTo', false);
        if (toDate === null) return;
        const clinic = await window.db.get('settings', 'clinic_info') || {};

        const payments = await window.db.getAll('payments');
        const invoices = await window.db.getAll('invoices');

        const periodPayments = payments.filter(p => (!fromDate || p.date >= fromDate) && (!toDate || p.date <= toDate));
        const periodInvoices = invoices.filter(i => (!fromDate || i.date >= fromDate) && (!toDate || i.date <= toDate));

        const expenses = await window.db.getAll('expenses');
        const periodExpenses = expenses.filter(e => (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate));

        const totalRevenue = periodPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const totalBilled = periodInvoices.reduce((s, i) => s + (parseFloat(i.netTotal) || 0), 0);
        const totalDiscounts = periodInvoices.reduce((s, i) => s + (parseFloat(i.discount) || 0), 0);
        const totalExpenses = periodExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const netIncome = totalRevenue - totalExpenses;

        const printArea = document.getElementById('printableContent');
        printArea.innerHTML = `
            ${this.buildLetterheadHTML()}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="color:#0284c7; font-size:1.3rem; margin:0;">${this.t('التقرير المالي وحركة الصندوق', 'Financial Report & Cash Movements')}</h2>
                <div style="text-align:left;">
                    <p style="margin:2px 0; color:#475569; font-size:0.92rem;">${this.t('الفترة', 'Period')}: ${this.t('من', 'from')} <strong>${fromDate || this.t('البداية', 'the beginning')}</strong> ${this.t('إلى', 'to')} <strong>${toDate || this.t('اليوم', 'today')}</strong></p>
                    <p style="margin:2px 0; color:#64748b; font-size:0.85rem;">${this.t('تاريخ الطباعة', 'Print Date')}: <strong>${this.formatDateAR(this.todayISO())}</strong></p>
                </div>
            </div>

            <!-- KPIs Summary Boxes -->
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:22px;">
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:12px; border-radius:6px; text-align:center;">
                    <span style="font-size:0.85rem; color:#166534; font-weight:700;">${this.t('إجمالي المقبوضات (النقدية والبنكية)', 'Total Receipts (Cash & Bank)')}</span>
                    <h3 style="margin:5px 0 0 0; color:#15803d; font-size:1.35rem;">$${totalRevenue.toFixed(2)}</h3>
                </div>
                <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:12px; border-radius:6px; text-align:center;">
                    <span style="font-size:0.85rem; color:#1e40af; font-weight:700;">${this.t('إجمالي الفواتير الصادرة', 'Total Invoices Issued')}</span>
                    <h3 style="margin:5px 0 0 0; color:#1d4ed8; font-size:1.35rem;">$${totalBilled.toFixed(2)}</h3>
                </div>
                <div style="background:#fffbeb; border:1px solid #fde68a; padding:12px; border-radius:6px; text-align:center;">
                    <span style="font-size:0.85rem; color:#92400e; font-weight:700;">${this.t('إجمالي الخصومات الممنوحة', 'Total Discounts Given')}</span>
                    <h3 style="margin:5px 0 0 0; color:#b45309; font-size:1.35rem;">$${totalDiscounts.toFixed(2)}</h3>
                </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; margin-bottom:22px;">
                <div style="background:#faf5ff; border:1px solid #e9d5ff; padding:12px; border-radius:6px; text-align:center;">
                    <span style="font-size:0.85rem; color:#6b21a8; font-weight:700;">${this.t('إجمالي المصاريف', 'Total Expenses')}</span>
                    <h3 style="margin:5px 0 0 0; color:#7e22ce; font-size:1.35rem;">$${totalExpenses.toFixed(2)}</h3>
                </div>
                <div style="background:${netIncome < 0 ? '#fef2f2' : '#eff6ff'}; border:1px solid ${netIncome < 0 ? '#fecaca' : '#bfdbfe'}; padding:12px; border-radius:6px; text-align:center;">
                    <span style="font-size:0.85rem; color:${netIncome < 0 ? '#991b1b' : '#1e40af'}; font-weight:700;">${this.t('صافي الدخل', 'Net Income')}</span>
                    <h3 style="margin:5px 0 0 0; color:${netIncome < 0 ? '#dc2626' : '#1d4ed8'}; font-size:1.35rem;">$${netIncome.toFixed(2)}</h3>
                </div>
            </div>

            <!-- Detailed Table -->
            <h4 style="color:#0f172a; margin:0 0 10px 0; font-size:1.05rem;">${this.t(`سجل المقبوضات وسندات القبض المسجلة خلال الفترة (${periodPayments.length} حركة):`, `Receipts & Payments Recorded During the Period (${periodPayments.length} transactions):`)}</h4>
            <table style="width:100%; border-collapse:collapse; margin-bottom:25px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">#</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('رقم الإيصال', 'Receipt No.')}</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('التاريخ', 'Date')}</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('اسم المريض', 'Patient Name')}</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('طريقة الدفع', 'Payment Method')}</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('المبلغ المقبوض', 'Amount Received')}</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('ملاحظات', 'Notes')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${periodPayments.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding:15px; border:1px solid #cbd5e1; color:#64748b;">${this.t('لا توجد حركات مالية مسجلة خلال الفترة المحددة.', 'No financial transactions recorded during the selected period.')}</td></tr>` :
                    periodPayments.map((p, idx) => `
                        <tr>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;">${idx + 1}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;"><strong>${p.receiptNumber || 'REC'}</strong></td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;">${this.formatDateAR(p.date)}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;">${this.escapeHTML(p.patientName || '--')}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;">${p.method === 'cash' ? this.t('نقدي', 'Cash') : (p.method === 'card' ? this.t('بطاقة', 'Card') : this.t('تحويل', 'Transfer'))}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px; font-weight:bold; color:#15803d;">$${(parseFloat(p.amount) || 0).toFixed(2)}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px; color:#475569;">${this.escapeHTML(p.notes || '--')}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background:#f8fafc; font-weight:bold;">
                        <td colspan="5" style="border:1px solid #cbd5e1; padding:9px 10px; text-align:left;">${this.t('المجموع الإجمالي للمقبوضات', 'Grand Total of Receipts')}:</td>
                        <td colspan="2" style="border:1px solid #cbd5e1; padding:9px 10px; color:#15803d; font-size:1.1rem;">$${totalRevenue.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>

            <h4 style="color:#0f172a; margin:0 0 10px 0; font-size:1.05rem;">${this.t(`مصاريف العيادة المسجلة خلال الفترة (${periodExpenses.length} مصروف):`, `Clinic Expenses Recorded During the Period (${periodExpenses.length} expenses):`)}</h4>
            <table style="width:100%; border-collapse:collapse; margin-bottom:25px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">#</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('التاريخ', 'Date')}</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('الوصف', 'Description')}</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('المبلغ', 'Amount')}</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('ملاحظات', 'Notes')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${periodExpenses.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:15px; border:1px solid #cbd5e1; color:#64748b;">${this.t('لا توجد مصاريف مسجلة بعد.', 'No expenses recorded yet.')}</td></tr>` :
                    periodExpenses.map((e, idx) => `
                        <tr>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;">${idx + 1}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;">${this.formatDateAR(e.date)}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;">${this.escapeHTML(e.description)}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px; font-weight:bold; color:#b91c1c;">$${(parseFloat(e.amount) || 0).toFixed(2)}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px; color:#475569;">${this.escapeHTML(e.notes || '--')}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background:#f8fafc; font-weight:bold;">
                        <td colspan="3" style="border:1px solid #cbd5e1; padding:9px 10px; text-align:left;">${this.t('المجموع الإجمالي للمصاريف', 'Grand Total of Expenses')}:</td>
                        <td colspan="2" style="border:1px solid #cbd5e1; padding:9px 10px; color:#b91c1c; font-size:1.1rem;">$${totalExpenses.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>

            <div style="margin-top:40px; display:flex; justify-content:space-between; align-items:flex-end;">
                <div>${this.t('توقيع المسؤول المالي / الطبيب', "Financial Officer / Doctor's Signature")}: _______________________</div>
            </div>
            ${this.buildLetterheadFooterHTML(clinic)}
        `;

        window.print();
    }

    // ==========================================
    // 10b. NEW PATIENT REGISTRATIONS REPORT
    // ==========================================
    async getPatientRegistrationsInRange(fromDate, toDate) {
        const patients = await window.db.getAll('patients');
        return patients
            .filter(p => {
                const regDate = this.normalizeStoredDate(p.createdAt || '');
                return (!fromDate || regDate >= fromDate) && (!toDate || regDate <= toDate);
            })
            .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    }

    async runPatientRegistrationsReport() {
        const fromDate = this.validateDateInput('regReportFrom', false);
        if (fromDate === null) return;
        const toDate = this.validateDateInput('regReportTo', false);
        if (toDate === null) return;

        const matches = await this.getPatientRegistrationsInRange(fromDate, toDate);
        const countEl = document.getElementById('regReportCount');
        if (countEl) countEl.textContent = matches.length;

        const tbody = document.getElementById('regReportTableBody');
        if (!tbody) return;
        if (matches.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">${this.t('لا يوجد مرضى مسجلين خلال هذه الفترة.', 'No patients registered during this period.')}</td></tr>`;
            return;
        }
        tbody.innerHTML = matches.map(p => `
            <tr>
                <td><strong>${this.escapeHTML(p.patientCode)}</strong></td>
                <td>${this.escapeHTML(p.name)}</td>
                <td>${this.formatDateAR(this.normalizeStoredDate(p.createdAt || ''))}</td>
                <td>${this.escapeHTML(p.phone || '--')}</td>
                <td>${this.escapeHTML(p.referredBy || '--')}</td>
            </tr>
        `).join('');
    }

    async printPatientRegistrationsReport() {
        const fromDate = this.validateDateInput('regReportFrom', false);
        if (fromDate === null) return;
        const toDate = this.validateDateInput('regReportTo', false);
        if (toDate === null) return;
        const clinic = await window.db.get('settings', 'clinic_info') || {};

        const matches = await this.getPatientRegistrationsInRange(fromDate, toDate);

        const printArea = document.getElementById('printableContent');
        printArea.innerHTML = `
            ${this.buildLetterheadHTML()}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="color:#0284c7; font-size:1.3rem; margin:0;">${this.t('تقرير تسجيل المرضى الجدد', 'New Patient Registrations Report')}</h2>
                <div style="text-align:left;">
                    <p style="margin:2px 0; color:#475569; font-size:0.92rem;">${this.t('الفترة', 'Period')}: ${this.t('من', 'from')} <strong>${fromDate || this.t('البداية', 'the beginning')}</strong> ${this.t('إلى', 'to')} <strong>${toDate || this.t('اليوم', 'today')}</strong></p>
                    <p style="margin:2px 0; color:#64748b; font-size:0.85rem;">${this.t('عدد المرضى الجدد خلال الفترة:', 'Number of new patients during this period:')} <strong>${matches.length}</strong></p>
                </div>
            </div>
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">#</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('رقم الملف', 'Record No.')}</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('اسم المريض', 'Patient Name')}</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('تاريخ التسجيل', 'Registration Date')}</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('رقم الهاتف', 'Phone Number')}</th>
                        <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('وصل عن طريق', 'Referred by')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${matches.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:15px; border:1px solid #cbd5e1; color:#64748b;">${this.t('لا يوجد مرضى مسجلين خلال هذه الفترة.', 'No patients registered during this period.')}</td></tr>` :
                    matches.map((p, idx) => `
                        <tr>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;">${idx + 1}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;"><strong>${this.escapeHTML(p.patientCode)}</strong></td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;">${this.escapeHTML(p.name)}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;">${this.formatDateAR(this.normalizeStoredDate(p.createdAt || ''))}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;">${this.escapeHTML(p.phone || '--')}</td>
                            <td style="border:1px solid #cbd5e1; padding:7px 10px;">${this.escapeHTML(p.referredBy || '--')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${this.buildLetterheadFooterHTML(clinic)}
        `;
        window.print();
    }

    // ==========================================
    // 10c. PROCEDURE TYPE REPORT
    // ==========================================
    getPlanStatusLabel(status) {
        if (status === 'in_progress') return this.t('قيد التنفيذ', 'In Progress');
        if (status === 'completed') return this.t('مكتمل ✅', 'Completed ✅');
        return this.t('مجدول', 'Planned');
    }

    // Flattens every treatment-plan entry across all patients, tagged with
    // who it belongs to, so it can be filtered/grouped by category and date
    // regardless of which patient it's on.
    // What each invoiced procedure actually costs after the invoice discount:
    // the discount is shared across the invoice's items in proportion to their price.
    buildPlanNetMap(invoices) {
        const map = new Map();
        invoices.forEach(inv => {
            const items = inv.items || [];
            const subtotal = items.reduce((s, it) => s + (parseFloat(it.price) || 0), 0);
            if (subtotal <= 0) return;
            const ratio = Math.max(0, (parseFloat(inv.netTotal) || 0)) / subtotal;
            items.forEach(it => { if (it.treatmentPlanId) map.set(it.treatmentPlanId, Math.round((parseFloat(it.price) || 0) * ratio * 100) / 100); });
        });
        return map;
    }

    // Start (session) date while in progress; the completion date once Completed.
    planReportDate(plan) {
        if (plan.status === 'completed' && plan.completedDate) return plan.completedDate;
        return plan.date || plan.createdAt;
    }

    async getAllTreatmentPlanRows() {
        const [patients, invoices] = await Promise.all([window.db.getAll('patients'), window.db.getAll('invoices')]);
        const netMap = this.buildPlanNetMap(invoices);
        const rows = [];
        for (const p of patients) {
            for (const tp of (p.treatmentPlans || [])) {
                // Reports date a procedure by its session date (what the doctor chose), not the day it was typed in.
                rows.push({ ...tp, cost: netMap.has(tp.id) ? netMap.get(tp.id) : tp.cost, createdAt: this.planReportDate(tp), patientId: p.id, patientName: p.name, patientCode: p.patientCode });
            }
        }
        return rows;
    }

    // A plan like "X-Ray ×3" is three procedures: count its quantity, not one row.
    getPlanQty(plan) {
        const q = parseInt(plan.quantity, 10) || parseInt((String(plan.procedure || '').match(/×\s*(\d+)/) || [])[1], 10) || 1;
        return Math.max(1, q);
    }

    sumQty(rows) {
        return rows.reduce((s, r) => s + this.getPlanQty(r), 0);
    }

    async getFilteredProcedureRows(fromDate, toDate, conditionKey) {
        const allRows = await this.getAllTreatmentPlanRows();
        return allRows.filter(r => {
            const d = this.normalizeStoredDate(r.createdAt || '');
            const inRange = (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
            const matchesCondition = !conditionKey || r.condition === conditionKey;
            return inRange && matchesCondition;
        });
    }

    async runProcedureTypeReport() {
        const fromDate = this.validateDateInput('procReportFrom', false);
        if (fromDate === null) return;
        const toDate = this.validateDateInput('procReportTo', false);
        if (toDate === null) return;
        const conditionKey = document.getElementById('procReportCondition').value;

        const filtered = await this.getFilteredProcedureRows(fromDate, toDate, conditionKey);
        const thead = document.getElementById('procReportTableHead');
        const tbody = document.getElementById('procReportTableBody');
        const summaryDiv = document.getElementById('procReportSummary');
        if (!thead || !tbody || !summaryDiv) return;

        if (!conditionKey) {
            const groups = {};
            filtered.forEach(r => {
                const key = r.condition || 'other';
                if (!groups[key]) groups[key] = { rows: [], patients: new Set() };
                groups[key].rows.push(r);
                groups[key].patients.add(r.patientId);
            });
            const sortedKeys = Object.keys(groups).sort((a, b) => this.sumQty(groups[b].rows) - this.sumQty(groups[a].rows));

            summaryDiv.innerHTML = `<div style="margin-bottom:14px; font-weight:800; color:var(--text-main);">${this.t('إجمالي الإجراءات', 'Total Procedures')}: <span style="color:var(--primary);">${filtered.length}</span></div>`;
            const chartContainer = document.getElementById('procReportChart');
            if (chartContainer) {
                if (sortedKeys.length === 0) chartContainer.innerHTML = '';
                else {
                    // Top 7 types get their own slice; the rest are lumped into "Other"
                    // so the donut stays readable instead of a ring of slivers.
                    const top = sortedKeys.slice(0, 7).map(key => {
                        const cond = TOOTH_CONDITIONS[key];
                        return { label: cond ? this.t(cond.labelAr, cond.labelEn) : key, value: this.sumQty(groups[key].rows) };
                    });
                    const restCount = sortedKeys.slice(7).reduce((s, k) => s + this.sumQty(groups[k].rows), 0);
                    const segments = restCount > 0 ? [...top, { label: this.t('أخرى', 'Other'), value: restCount, color: '#94a3b8' }] : top;
                    chartContainer.innerHTML = `<div style="display:flex; gap:26px; align-items:center; flex-wrap:wrap;">${this.buildDonutChartSVG(segments)}<div>${this.buildChartLegendHTML(segments)}</div></div>`;
                }
            }
            thead.innerHTML = `<tr><th>${this.t('النوع', 'Type')}</th><th>${this.t('العدد', 'Count')}</th><th>${this.t('عدد المرضى', 'Patient Count')}</th><th>${this.t('إجمالي التكلفة', 'Total Cost')}</th></tr>`;
            tbody.innerHTML = sortedKeys.length === 0
                ? `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">${this.t('لا توجد إجراءات مطابقة خلال هذه الفترة.', 'No matching procedures during this period.')}</td></tr>`
                : sortedKeys.map(key => {
                    const cond = TOOTH_CONDITIONS[key];
                    const label = cond ? this.t(cond.labelAr, cond.labelEn) : key;
                    const totalCost = groups[key].rows.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
                    return `<tr><td><strong>${label}</strong></td><td>${this.sumQty(groups[key].rows)}</td><td>${groups[key].patients.size}</td><td>$${totalCost.toFixed(2)}</td></tr>`;
                }).join('');
        } else {
            const chartContainer0 = document.getElementById('procReportChart');
            if (chartContainer0) chartContainer0.innerHTML = '';
            const distinctPatients = new Set(filtered.map(r => r.patientId)).size;
            const totalCost = filtered.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
            summaryDiv.innerHTML = `<div style="display:flex; gap:20px; flex-wrap:wrap; margin-bottom:14px; font-weight:800; color:var(--text-main);">
                <span>${this.t('إجمالي الإجراءات', 'Total Procedures')}: <span style="color:var(--primary);">${this.sumQty(filtered)}</span></span>
                <span>${this.t('عدد المرضى', 'Patient Count')}: <span style="color:var(--primary);">${distinctPatients}</span></span>
                <span>${this.t('إجمالي التكلفة', 'Total Cost')}: <span style="color:var(--primary);">$${totalCost.toFixed(2)}</span></span>
            </div>`;
            thead.innerHTML = `<tr><th>${this.t('اسم المريض', 'Patient Name')}</th><th>${this.t('رقم السن', 'Tooth No.')}</th><th>${this.t('التاريخ', 'Date')}</th><th>${this.t('الحالة', 'Status')}</th><th>${this.t('التكلفة', 'Cost')}</th></tr>`;
            const sorted = [...filtered].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            tbody.innerHTML = sorted.length === 0
                ? `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">${this.t('لا توجد إجراءات مطابقة خلال هذه الفترة.', 'No matching procedures during this period.')}</td></tr>`
                : sorted.map(r => `
                    <tr>
                        <td><a href="javascript:void(0)" onclick="window.app.openPatientProfile('${r.patientId}')" style="color:var(--primary); font-weight:700;">${this.escapeHTML(r.patientName)}</a></td>
                        <td>${r.toothNum || '--'}</td>
                        <td>${this.formatDateAR(this.normalizeStoredDate(r.createdAt || ''))}</td>
                        <td>${this.getPlanStatusLabel(r.status)}</td>
                        <td>$${(parseFloat(r.cost) || 0).toFixed(2)}</td>
                    </tr>
                `).join('');
        }
    }

    async printProcedureTypeReport(asPDF = false) {
        const fromDate = this.validateDateInput('procReportFrom', false);
        if (fromDate === null) return;
        const toDate = this.validateDateInput('procReportTo', false);
        if (toDate === null) return;
        const conditionKey = document.getElementById('procReportCondition').value;
        const clinic = await window.db.get('settings', 'clinic_info') || {};

        const filtered = await this.getFilteredProcedureRows(fromDate, toDate, conditionKey);
        const conditionLabel = conditionKey
            ? (TOOTH_CONDITIONS[conditionKey] ? this.t(TOOTH_CONDITIONS[conditionKey].labelAr, TOOTH_CONDITIONS[conditionKey].labelEn) : conditionKey)
            : this.t('الكل', 'All');

        let bodyHtml;
        if (!conditionKey) {
            const groups = {};
            filtered.forEach(r => {
                const key = r.condition || 'other';
                if (!groups[key]) groups[key] = { rows: [], patients: new Set() };
                groups[key].rows.push(r);
                groups[key].patients.add(r.patientId);
            });
            const sortedKeys = Object.keys(groups).sort((a, b) => this.sumQty(groups[b].rows) - this.sumQty(groups[a].rows));
            bodyHtml = `
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('النوع', 'Type')}</th>
                            <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('العدد', 'Count')}</th>
                            <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('عدد المرضى', 'Patient Count')}</th>
                            <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('إجمالي التكلفة', 'Total Cost')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedKeys.length === 0 ? `<tr><td colspan="4" style="text-align:center; padding:15px; border:1px solid #cbd5e1;">${this.t('لا توجد إجراءات مطابقة خلال هذه الفترة.', 'No matching procedures during this period.')}</td></tr>` :
                        sortedKeys.map(key => {
                            const cond = TOOTH_CONDITIONS[key];
                            const label = cond ? this.t(cond.labelAr, cond.labelEn) : key;
                            const totalCost = groups[key].rows.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
                            return `<tr><td style="border:1px solid #cbd5e1; padding:7px 10px;"><strong>${label}</strong></td><td style="border:1px solid #cbd5e1; padding:7px 10px;">${this.sumQty(groups[key].rows)}</td><td style="border:1px solid #cbd5e1; padding:7px 10px;">${groups[key].patients.size}</td><td style="border:1px solid #cbd5e1; padding:7px 10px;">$${totalCost.toFixed(2)}</td></tr>`;
                        }).join('')}
                    </tbody>
                </table>`;
        } else {
            const sorted = [...filtered].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            bodyHtml = `
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">#</th>
                            <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('اسم المريض', 'Patient Name')}</th>
                            <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('رقم السن', 'Tooth No.')}</th>
                            <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('التاريخ', 'Date')}</th>
                            <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('الحالة', 'Status')}</th>
                            <th style="border:1px solid #cbd5e1; padding:8px 10px; text-align:right;">${this.t('التكلفة', 'Cost')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:15px; border:1px solid #cbd5e1;">${this.t('لا توجد إجراءات مطابقة خلال هذه الفترة.', 'No matching procedures during this period.')}</td></tr>` :
                        sorted.map((r, idx) => `
                            <tr>
                                <td style="border:1px solid #cbd5e1; padding:7px 10px;">${idx + 1}</td>
                                <td style="border:1px solid #cbd5e1; padding:7px 10px;">${this.escapeHTML(r.patientName)}</td>
                                <td style="border:1px solid #cbd5e1; padding:7px 10px;">${r.toothNum || '--'}</td>
                                <td style="border:1px solid #cbd5e1; padding:7px 10px;">${this.formatDateAR(this.normalizeStoredDate(r.createdAt || ''))}</td>
                                <td style="border:1px solid #cbd5e1; padding:7px 10px;">${this.getPlanStatusLabel(r.status)}</td>
                                <td style="border:1px solid #cbd5e1; padding:7px 10px;">$${(parseFloat(r.cost) || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
        }

        const printArea = document.getElementById('printableContent');
        printArea.innerHTML = `
            ${this.buildLetterheadHTML()}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="color:#0284c7; font-size:1.3rem; margin:0;">${this.t('تقرير الإجراءات حسب النوع', 'Procedure Type Report')}</h2>
                <div style="text-align:left;">
                    <p style="margin:2px 0; color:#475569; font-size:0.92rem;">${this.t('الفترة', 'Period')}: ${this.t('من', 'from')} <strong>${fromDate || this.t('البداية', 'the beginning')}</strong> ${this.t('إلى', 'to')} <strong>${toDate || this.t('اليوم', 'today')}</strong></p>
                    <p style="margin:2px 0; color:#64748b; font-size:0.85rem;">${this.t('نوع الإجراء', 'Procedure Type')}: <strong>${conditionLabel}</strong> — ${this.t('إجمالي الإجراءات', 'Total Procedures')}: <strong>${this.sumQty(filtered)}</strong></p>
                </div>
            </div>
            ${bodyHtml}
            ${this.buildLetterheadFooterHTML(clinic)}
        `;
        if (asPDF) {
            await this.exportPrintAreaToPDF(`Procedure_Report_${this.todayISO()}.pdf`);
        } else {
            window.print();
        }
    }

    async exportProcedureTypeReportToExcel() {
        const fromDate = this.validateDateInput('procReportFrom', false);
        if (fromDate === null) return;
        const toDate = this.validateDateInput('procReportTo', false);
        if (toDate === null) return;
        const conditionKey = document.getElementById('procReportCondition').value;

        if (typeof ExcelJS === 'undefined') {
            this.showToast(this.t('تعذر تحميل مكتبة Excel. تأكد من الاتصال بالإنترنت وحاول مجدداً.', 'Could not load the Excel library. Check your internet connection and try again.'), 'error');
            return;
        }

        const filtered = await this.getFilteredProcedureRows(fromDate, toDate, conditionKey);
        const workbook = new ExcelJS.Workbook();
        let sheet, columns;

        if (!conditionKey) {
            const groups = {};
            filtered.forEach(r => {
                const key = r.condition || 'other';
                if (!groups[key]) groups[key] = { rows: [], patients: new Set() };
                groups[key].rows.push(r);
                groups[key].patients.add(r.patientId);
            });
            const sortedKeys = Object.keys(groups).sort((a, b) => this.sumQty(groups[b].rows) - this.sumQty(groups[a].rows));
            sheet = workbook.addWorksheet(this.t('تقرير الإجراءات', 'Procedure Report'));
            sheet.addRow([this.t('النوع', 'Type'), this.t('العدد', 'Count'), this.t('عدد المرضى', 'Patient Count'), this.t('إجمالي التكلفة', 'Total Cost')]);
            sortedKeys.forEach(key => {
                const cond = TOOTH_CONDITIONS[key];
                const label = cond ? this.t(cond.labelAr, cond.labelEn) : key;
                const totalCost = groups[key].rows.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
                sheet.addRow([label, this.sumQty(groups[key].rows), groups[key].patients.size, totalCost]);
            });
            columns = [{ width: 30 }, { width: 12 }, { width: 16 }, { width: 16 }];
        } else {
            const sorted = [...filtered].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            sheet = workbook.addWorksheet(this.t('تقرير الإجراءات', 'Procedure Report'));
            sheet.addRow([this.t('اسم المريض', 'Patient Name'), this.t('رقم السن', 'Tooth No.'), this.t('التاريخ', 'Date'), this.t('الحالة', 'Status'), this.t('التكلفة', 'Cost')]);
            sorted.forEach(r => sheet.addRow([
                r.patientName, r.toothNum || '--', this.formatDateAR(this.normalizeStoredDate(r.createdAt || '')), this.getPlanStatusLabel(r.status), parseFloat(r.cost) || 0
            ]));
            columns = [{ width: 26 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 14 }];
        }
        sheet.columns = columns;

        const thinBorder = { style: 'thin' };
        sheet.eachRow({ includeEmpty: false }, row => {
            row.eachCell({ includeEmpty: false }, cell => {
                cell.font = { size: 16 };
                cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            });
        });
        sheet.getRow(1).eachCell({ includeEmpty: false }, cell => {
            cell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF595959' } };
        });

        const dateStr = new Date().toISOString().slice(0, 10);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Procedure_Report_${dateStr}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast(this.t('تم تصدير التقرير بنجاح.', 'Report exported successfully.'), 'success');
    }

    // Renders whatever is currently in #printableContent to a paginated A4 PDF
    // (same layout as the printout), so any printable document can also be
    // saved as a file to send to a patient.
    async exportPrintAreaToPDF(filename, html) {
        const source = document.getElementById('printableContent');
        const holder = document.createElement('div');
        holder.style.cssText = 'position:fixed; left:-9999px; top:0; width:794px; background:#fff; padding:36px; color:#111; box-sizing:border-box;';
        holder.innerHTML = html || source.innerHTML;
        document.body.appendChild(holder);
        try {
            // Make sure any <img> (e.g. the clinic seal) is actually loaded —
            // html2canvas captures whatever is painted right now, image or not.
            await Promise.all([...holder.querySelectorAll('img')].map(img => img.complete ? null : new Promise(res => { img.onload = img.onerror = res; })));
            const canvas = await html2canvas(holder, { scale: 2, backgroundColor: '#ffffff' });
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const imgH = (canvas.height * pageW) / canvas.width;
            const img = canvas.toDataURL('image/png');
            let offset = 0;
            pdf.addImage(img, 'PNG', 0, 0, pageW, imgH);
            while (imgH - offset > pageH) {
                offset += pageH;
                pdf.addPage();
                pdf.addImage(img, 'PNG', 0, -offset, pageW, imgH);
            }
            pdf.save(filename);
        } finally {
            document.body.removeChild(holder);
        }
    }

    // ==========================================
    // 10d. DAILY INCOME & EXPENSES LEDGER
    // ==========================================
    // Groups payments and expenses by day: each day gets one row carrying its
    // income total, then one extra row per additional expense that day (so a
    // day with three expenses prints as three rows, date shown once) — this
    // mirrors the paper ledger layout the clinic already uses.
    async buildDailyLedger(fromDate, toDate) {
        const payments = await window.db.getAll('payments');
        const expenses = await window.db.getAll('expenses');
        const periodPayments = payments.filter(p => (!fromDate || p.date >= fromDate) && (!toDate || p.date <= toDate));
        const periodExpenses = expenses.filter(e => (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate));

        const dateMap = {};
        const ensureDate = d => { if (!dateMap[d]) dateMap[d] = { income: 0, expenseItems: [] }; return dateMap[d]; };
        periodPayments.forEach(p => { ensureDate(this.normalizeStoredDate(p.date)).income += parseFloat(p.amount) || 0; });
        periodExpenses.forEach(e => { ensureDate(this.normalizeStoredDate(e.date)).expenseItems.push({ description: e.description, amount: parseFloat(e.amount) || 0 }); });

        const sortedDates = Object.keys(dateMap).sort();
        const rows = [];
        sortedDates.forEach(d => {
            const entry = dateMap[d];
            const lineCount = Math.max(1, entry.expenseItems.length);
            for (let i = 0; i < lineCount; i++) {
                rows.push({
                    date: i === 0 ? d : '',
                    income: i === 0 && entry.income > 0 ? entry.income : null,
                    expenseDesc: entry.expenseItems[i] ? entry.expenseItems[i].description : '',
                    expenseAmt: entry.expenseItems[i] ? entry.expenseItems[i].amount : null
                });
            }
        });

        const totalIncome = periodPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const totalExpenses = periodExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        return { rows, totalIncome, totalExpenses };
    }

    async runDailyLedgerReport() {
        const fromDate = this.validateDateInput('ledgerReportFrom', false);
        if (fromDate === null) return;
        const toDate = this.validateDateInput('ledgerReportTo', false);
        if (toDate === null) return;

        const { rows, totalIncome, totalExpenses } = await this.buildDailyLedger(fromDate, toDate);
        const tbody = document.getElementById('ledgerReportTableBody');
        if (!tbody) return;

        const bodyRows = rows.length === 0
            ? `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">${this.t('لا توجد حركات خلال هذه الفترة.', 'No activity during this period.')}</td></tr>`
            : rows.map(r => `
                <tr>
                    <td>${r.date ? this.formatDateAR(r.date) : ''}</td>
                    <td>${r.income !== null ? '$' + r.income.toFixed(2) : ''}</td>
                    <td>${r.expenseDesc ? this.escapeHTML(r.expenseDesc) : ''}</td>
                    <td>${r.expenseAmt !== null ? '$' + r.expenseAmt.toFixed(2) : ''}</td>
                </tr>
            `).join('');

        tbody.innerHTML = bodyRows + `
            <tr style="font-weight:800; background:#f8fafc;">
                <td>${this.t('الإجمالي', 'Total')}</td>
                <td>$${totalIncome.toFixed(2)}</td>
                <td></td>
                <td>$${totalExpenses.toFixed(2)}</td>
            </tr>`;
    }

    async exportDailyLedgerToExcel() {
        const fromDate = this.validateDateInput('ledgerReportFrom', false);
        if (fromDate === null) return;
        const toDate = this.validateDateInput('ledgerReportTo', false);
        if (toDate === null) return;

        if (typeof ExcelJS === 'undefined') {
            this.showToast(this.t('تعذر تحميل مكتبة Excel. تأكد من الاتصال بالإنترنت وحاول مجدداً.', 'Could not load the Excel library. Check your internet connection and try again.'), 'error');
            return;
        }

        const { rows, totalIncome, totalExpenses } = await this.buildDailyLedger(fromDate, toDate);

        const aoa = [[this.t('التاريخ', 'Date'), this.t('الدخل $', 'Income $'), this.t('وصف المصروف', 'Expense Description'), this.t('المصروف $', 'Expenses $')]];
        rows.forEach(r => aoa.push([
            r.date ? this.formatDateAR(r.date) : '',
            r.income !== null ? r.income : '',
            r.expenseDesc || '',
            r.expenseAmt !== null ? r.expenseAmt : ''
        ]));
        aoa.push([this.t('الإجمالي', 'Total'), totalIncome, '', totalExpenses]);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(this.t('السجل اليومي', 'Daily Ledger'));
        aoa.forEach(rowValues => sheet.addRow(rowValues));
        sheet.columns = [{ width: 16 }, { width: 14 }, { width: 34 }, { width: 14 }];

        const thinBorder = { style: 'thin' };
        sheet.eachRow({ includeEmpty: false }, row => {
            row.eachCell({ includeEmpty: false }, cell => {
                cell.font = { size: 16 };
                cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            });
        });

        // Header row only — "White, Background 1, Darker 35%" fill, bold white text.
        sheet.getRow(1).eachCell({ includeEmpty: false }, cell => {
            cell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF595959' } };
        });

        const dateStr = new Date().toISOString().slice(0, 10);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Daily_Ledger_${dateStr}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast(this.t('تم تصدير التقرير بنجاح.', 'Report exported successfully.'), 'success');
    }

    // ==========================================
    // 11. ZERO-DATA-LOSS BACKUP & RESTORE
    // ==========================================
    // Builds the backup file, hands it to the browser as a download and
    // records the time. Shared by the manual button and the automatic daily one.
    async saveBackupFile(fileName) {
        const jsonStr = await window.db.exportFullBackup();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        await window.db.put('settings', { key: 'backup_meta', lastBackupAt: new Date().toISOString() });
        this.hideBackupReminder();
        this.renderLastBackupInfo();
    }

    async downloadFullBackup() {
        try {
            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const fileName = `AmaniClinic_Backup_${dateStr}.json`;
            await this.saveBackupFile(fileName);
            this.showToast(this.t(`تم حفظ النسخة الاحتياطية بنجاح (${fileName})`, `Backup saved successfully (${fileName})`), 'success');
        } catch (err) {
            this.showToast(this.t('خطأ أثناء حفظ النسخة الاحتياطية: ', 'Error saving the backup: ') + err.message, 'error');
        }
    }

    // Automatic daily backup: the first time the app is opened each day (and
    // no backup — manual or automatic — was already taken today), a backup
    // file is downloaded without asking. Skipped when there is no data yet,
    // so an empty database never produces a misleading "backup".
    async runAutoBackupIfDue() {
        try {
            const settings = await window.db.get('settings', 'auto_backup_settings');
            if (settings && settings.enabled === false) return;
            const meta = await window.db.get('settings', 'backup_meta');
            const last = meta?.lastBackupAt ? new Date(meta.lastBackupAt) : null;
            if (last && this.dateToISO(last) === this.todayISO()) return;
            if ((await window.db.getAll('patients')).length === 0) return;
            const fileName = `AmaniClinic_AutoBackup_${this.todayISO()}.json`;
            await this.saveBackupFile(fileName);
            this.showToast(this.t(`تم حفظ نسخة احتياطية تلقائية في مجلد التنزيلات (${fileName})`, `Automatic daily backup saved to your Downloads folder (${fileName})`), 'success');
        } catch (err) {
            console.error('Auto backup failed:', err);
            this.showToast(this.t('تعذّر حفظ النسخة الاحتياطية التلقائية. احفظي نسخة يدوياً من الإعدادات.', 'The automatic backup failed. Please save one manually from Settings.'), 'warning');
        }
    }

    async loadAutoBackupSetting() {
        const box = document.getElementById('settingAutoBackup');
        if (!box) return;
        const settings = await window.db.get('settings', 'auto_backup_settings');
        box.checked = !(settings && settings.enabled === false);
    }

    async setAutoBackupEnabled(enabled) {
        await window.db.put('settings', { key: 'auto_backup_settings', enabled: !!enabled, updatedAt: new Date().toISOString() });
        this.showToast(enabled ? this.t('تم تفعيل النسخ الاحتياطي التلقائي اليومي.', 'Automatic daily backup turned on.') : this.t('تم إيقاف النسخ الاحتياطي التلقائي.', 'Automatic daily backup turned off.'), 'info');
    }

    // Reminds the clinic to back up if it's been a while — there is no server,
    // so a manual JSON export is the only thing standing between the clinic
    // and total data loss if this computer fails.
    async checkBackupReminder() {
        const meta = await window.db.get('settings', 'backup_meta');
        const clinicInfo = await window.db.get('settings', 'clinic_info');
        const thresholdDays = Number(clinicInfo?.autoBackupDays) || 3;
        const lastBackupAt = meta?.lastBackupAt ? new Date(meta.lastBackupAt) : null;
        const daysSince = lastBackupAt ? Math.floor((Date.now() - lastBackupAt.getTime()) / 86400000) : null;

        const dismissedUntil = sessionStorage.getItem('dentflow_backup_reminder_dismissed');
        if (dismissedUntil === 'today') return;

        const isOverdue = daysSince === null || daysSince >= thresholdDays;
        if (!isOverdue) return;

        const banner = document.getElementById('backupReminderBanner');
        const text = document.getElementById('backupReminderText');
        if (!banner || !text) return;

        text.textContent = daysSince === null
            ? this.t('لم يتم إنشاء أي نسخة احتياطية بعد. يرجى حفظ نسخة احتياطية لحماية بيانات العيادة.', 'No backup has ever been made. Please save a backup to protect the clinic\'s data.')
            : this.t(`آخر نسخة احتياطية كانت منذ ${daysSince} ${daysSince === 1 ? 'يوم' : 'أيام'}. يُنصح بحفظ نسخة جديدة الآن.`, `Your last backup was ${daysSince} day${daysSince === 1 ? '' : 's'} ago. It's recommended to save a new one now.`);
        banner.style.display = 'flex';
    }

    hideBackupReminder() {
        const banner = document.getElementById('backupReminderBanner');
        if (banner) banner.style.display = 'none';
    }

    dismissBackupReminder() {
        sessionStorage.setItem('dentflow_backup_reminder_dismissed', 'today');
        this.hideBackupReminder();
    }

    async restoreBackupFromFile(fileInput) {
        if (!fileInput.files || !fileInput.files[0]) return;
        const file = fileInput.files[0];
        if (!confirm(this.t(`⚠️ تحذير: استعادة النسخة من (${file.name}) ستقوم بتحديث قاعدة البيانات. هل ترغب بالاستمرار؟`, `⚠️ Warning: Restoring from (${file.name}) will overwrite the database. Do you want to continue?`))) {
            fileInput.value = '';
            return;
        }

        try {
            const text = await file.text();
            await window.db.restoreFullBackup(text);
            this.showToast(this.t('تمت استعادة كافة البيانات بنجاح تام! 🚀', 'All data restored successfully! 🚀'), 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
            this.showToast(this.t('فشلت الاستعادة: ', 'Restore failed: ') + err.message, 'error');
        }
    }

    async loadClinicSettings() {
        const info = await window.db.get('settings', 'clinic_info');
        if (info) {
            document.getElementById('settingClinicName').value = info.name || '';
            document.getElementById('settingDoctorName').value = info.doctor || '';
            document.getElementById('settingSpecialty').value = info.specialty || '';
            document.getElementById('settingPhone').value = info.phone || '';
            document.getElementById('settingAddress').value = info.address || '';
        }
        const language = document.getElementById('settingLanguage');
        if (language) language.value = this.interfaceLanguage;
        const colorInput = document.getElementById('settingPrimaryColor');
        if (colorInput) colorInput.value = this.brandColor || '#0284c7';
    }

    async saveClinicSettings() {
        const phone = document.getElementById('settingPhone').value.trim();
        if (phone && !this.isValidPhone(phone)) {
            this.showToast(this.t('رقم هاتف العيادة غير صالح. يرجى إدخال أرقام فقط (7 أرقام على الأقل).', 'The clinic phone number is invalid. Please enter digits only (at least 7).'), 'warning');
            document.getElementById('settingPhone').focus();
            return;
        }

        const existing = await window.db.get('settings', 'clinic_info') || {};
        const info = {
            ...existing,
            key: 'clinic_info',
            name: document.getElementById('settingClinicName').value.trim(),
            doctor: document.getElementById('settingDoctorName').value.trim(),
            specialty: document.getElementById('settingSpecialty').value.trim(),
            phone,
            address: document.getElementById('settingAddress').value.trim()
        };

        await window.db.put('settings', info);
        this.showToast(this.t('تم حفظ إعدادات العيادة بنجاح.', 'Clinic settings saved successfully.'), 'success');
    }

    // ==========================================
    // 12. STAFF ACCOUNTS & LOGIN (Accountability)
    // ==========================================
    async initStaffSystem() {
        const staffList = await window.db.getAll('staff');
        if (staffList.length === 0) {
            this.activeStaff = null;
            return;
        }

        const savedSession = sessionStorage.getItem('dentflow_active_staff');
        if (savedSession) {
            try {
                const parsed = JSON.parse(savedSession);
                if (staffList.some(s => s.id === parsed.id)) {
                    this.activeStaff = parsed;
                    this.updateActiveStaffBadge();
                    return;
                }
            } catch { /* fall through to login */ }
        }

        this.showStaffLoginModal(staffList);
    }

    showStaffLoginModal(staffList) {
        const select = document.getElementById('staffLoginSelect');
        if (select) {
            select.innerHTML = staffList.map(s => `<option value="${s.id}">${this.escapeHTML(s.name)}</option>`).join('');
            if (select.parentElement) select.parentElement.style.display = staffList.length > 1 ? '' : 'none';
        }
        document.getElementById('staffLoginPin').value = '';
        document.getElementById('staffLoginError').style.display = 'none';
        this.openModal('staffLoginModal');
    }

    async attemptStaffLogin() {
        const staffId = document.getElementById('staffLoginSelect').value;
        const pin = document.getElementById('staffLoginPin').value.trim();
        const errorDiv = document.getElementById('staffLoginError');

        const staff = await window.db.get('staff', staffId);
        if (!staff || staff.pin !== pin) {
            errorDiv.textContent = this.t('الرمز السري غير صحيح.', 'Incorrect PIN.');
            errorDiv.style.display = 'block';
            document.getElementById('staffLoginPin').value = '';
            document.getElementById('staffLoginPin').focus();
            return;
        }

        this.activeStaff = { id: staff.id, name: staff.name };
        sessionStorage.setItem('dentflow_active_staff', JSON.stringify(this.activeStaff));
        this.updateActiveStaffBadge();
        this.closeModal('staffLoginModal');
        this.showToast(this.t(`أهلاً بك، ${staff.name} 👋`, `Welcome, ${staff.name} 👋`), 'success');
    }

    async logoutStaff() {
        if (!confirm(this.t('هل تريد تسجيل الخروج وتبديل المستخدم؟', 'Log out and switch user?'))) return;
        sessionStorage.removeItem('dentflow_active_staff');
        this.activeStaff = null;
        this.updateActiveStaffBadge();
        const staffList = await window.db.getAll('staff');
        if (staffList.length > 0) this.showStaffLoginModal(staffList);
    }

    updateActiveStaffBadge() {
        const badge = document.getElementById('activeStaffBadge');
        const nameSpan = document.getElementById('activeStaffName');
        if (!badge || !nameSpan) return;
        if (this.activeStaff) {
            nameSpan.textContent = this.activeStaff.name;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    async openManageStaffModal() {
        document.getElementById('staffForm').reset();
        document.getElementById('staffId').value = '';
        this.editingStaffId = null;
        await this.renderStaffTable();
        this.openModal('manageStaffModal');
    }

    async renderStaffTable() {
        const tbody = document.getElementById('staffTableBody');
        if (!tbody) return;
        const staffList = await window.db.getAll('staff');
        tbody.innerHTML = staffList.length ? staffList.map(s => `
            <tr>
                <td><strong>${this.escapeHTML(s.name)}</strong></td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="window.app.editStaff('${s.id}')">✏️ ${this.t('تعديل', 'Edit')}</button>
                    <button class="btn btn-danger btn-sm" onclick="window.app.deleteStaff('${s.id}')">🗑️</button>
                </td>
            </tr>`).join('') : `<tr><td colspan="2"style="text-align:center; color:var(--text-muted);">${this.t('لا يوجد موظفون بعد.', 'No staff accounts yet.')}</td></tr>`;
    }

    async saveStaff() {
        // Only one account is kept: saving always replaces the existing one.
        const current = await window.db.getAll('staff');
        const id = current[0]?.id || '';
        const name = document.getElementById('staffName').value.trim();
        const role = '';
        const pin = document.getElementById('staffPin').value.trim();

        if (!name || pin.length < 4) {
            this.showToast(this.t('يرجى إدخال اسم الموظف ورمز سري من 4 أرقام على الأقل.', "Please enter the staff member's name and a PIN of at least 4 digits."), 'warning');
            return;
        }

        const existing = id ? await window.db.get('staff', id) : null;
        await window.db.put('staff', {
            ...(existing || {}), id: id || `staff_${Date.now()}`, name, role, pin,
            updatedAt: new Date().toISOString()
        });
        document.getElementById('staffForm').reset();
        document.getElementById('staffId').value = '';
        this.editingStaffId = null;
        await this.renderStaffTable();
        this.showToast(this.t('تم حفظ حساب الموظف.', 'Staff account saved.'), 'success');
    }

    async editStaff(id) {
        const staff = await window.db.get('staff', id);
        if (!staff) return;
        document.getElementById('staffId').value = staff.id;
        document.getElementById('staffName').value = staff.name || '';
        document.getElementById('staffPin').value = staff.pin || '';
        this.editingStaffId = id;
        document.getElementById('staffName').focus();
    }

    async deleteStaff(id) {
        const staff = await window.db.get('staff', id);
        if (!staff || !confirm(this.t(`حذف حساب الموظف «${staff.name}»؟`, `Delete staff account "${staff.name}"?`))) return;
        await window.db.delete('staff', id);
        if (this.activeStaff?.id === id) {
            sessionStorage.removeItem('dentflow_active_staff');
            this.activeStaff = null;
            this.updateActiveStaffBadge();
        }
        await this.renderStaffTable();
        this.showToast(this.t('تم حذف حساب الموظف.', 'Staff account deleted.'), 'info');
    }

    // PRINT INVOICE & RX
    buildInvoiceHTML(invoice, clinic, payments = []) {
        const paid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const remaining = Math.max(0, invoice.netTotal - paid);
        const paymentsHTML = payments.length ? `
            <h4 style="margin:22px 0 8px 0;">${this.t('الدفعات', 'Payments')}</h4>
            <table style="text-align:center;">
                <thead><tr><th style="text-align:center;">${this.t('رقم السند', 'Receipt')}</th><th style="text-align:center;">${this.t('التاريخ', 'Date')}</th><th style="text-align:center;">${this.t('الطريقة', 'Method')}</th><th style="text-align:center;">${this.t('عن', 'For')}</th><th style="text-align:center;">${this.t('المبلغ', 'Amount')}</th></tr></thead>
                <tbody>${payments.map(p => `<tr><td style="text-align:center;">${this.escapeHTML(p.receiptNumber || '--')}</td><td style="text-align:center;">${this.formatDateAR(p.date)}</td><td style="text-align:center;">${this.paymentMethodLabel(p.method)}</td>
                    <td style="text-align:center;">${this.escapeHTML(p.itemLabel || this.t('الفاتورة كاملة', 'Whole invoice'))}</td><td style="text-align:center;">$${(parseFloat(p.amount) || 0).toFixed(2)}</td></tr>`).join('')}</tbody>
            </table>
            <div style="margin-top:12px; text-align:left; line-height:1.8;">
                <p>${this.t('المدفوع', 'Paid')}: <strong>$${paid.toFixed(2)}</strong></p>
                <h3>${this.t('المتبقي', 'Remaining')}: $${remaining.toFixed(2)}</h3>
            </div>` : '';
        return `
            ${this.buildLetterheadHTML()}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="color:var(--primary); margin:0;">${this.t('فاتورة علاج', 'Treatment Invoice')}</h3>
                <p style="margin:0; color:#475569; font-size:0.9rem;">${this.t('رقم الفاتورة', 'Invoice No.')}: <strong>${invoice.invoiceNumber}</strong> — ${this.t('التاريخ', 'Date')}: ${this.formatDateAR(invoice.date)}</p>
            </div>
            <div style="margin:18px 0; padding:10px; background:#f8fafc; border-radius:6px;">
                <p>${this.t('اسم المريض', 'Patient Name')}: <strong>${this.escapeHTML(invoice.patientName)}</strong></p>
            </div>
            <table style="text-align:center;">
                <thead>
                    <tr>
                        <th style="text-align:center;">#</th>
                        <th style="text-align:center;">${this.t('وصف الخدمة / الإجراء', 'Service / Procedure Description')}</th>
                        <th style="text-align:center;">${this.t('المبلغ ($)', 'Amount ($)')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.items.map((item, idx) => `
                        <tr>
                            <td style="text-align:center;">${idx + 1}</td>
                            <td style="text-align:center;">${this.escapeHTML(item.description)}</td>
                            <td style="text-align:center;">$${item.price.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="margin-top:20px; text-align:left; line-height:1.8;">
                <p>${this.t('المجموع الفرعي', 'Subtotal')}: <strong>$${invoice.subtotal.toFixed(2)}</strong></p>
                <p>${this.t('الخصم', 'Discount')}: <strong>$${invoice.discount.toFixed(2)}</strong></p>
                <h3 style="color:var(--primary);">${this.t('المجموع الصافي', 'Net Total')}: $${invoice.netTotal.toFixed(2)}</h3>
            </div>
            ${paymentsHTML}
            ${this.buildLetterheadFooterHTML(clinic)}
        `;
    }

    async getInvoicePayments(invoiceId) {
        return (await window.db.getAll('payments')).filter(p => p.invoiceId === invoiceId)
            .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    }

    // Deleting an invoice also removes the payments/receipts recorded against
    // it (they'd otherwise be orphaned and still count as income), so the
    // confirmation spells that out. Its treatment items become billable again.
    async deleteInvoice(invoiceId) {
        const invoice = await window.db.get('invoices', invoiceId);
        if (!invoice) return;
        const payments = (await window.db.getAll('payments')).filter(p => p.invoiceId === invoiceId);
        const paidTotal = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const msg = payments.length
            ? this.t(`حذف الفاتورة ${invoice.invoiceNumber}؟ سيتم أيضاً حذف ${payments.length} دفعة/سند مرتبطة بها (بمجموع $${paidTotal.toFixed(2)}). لا يمكن التراجع.`,
                     `Delete invoice ${invoice.invoiceNumber}? Its ${payments.length} payment(s)/receipt(s) totalling $${paidTotal.toFixed(2)} will be deleted too. This cannot be undone.`)
            : this.t(`حذف الفاتورة ${invoice.invoiceNumber}؟ لا يمكن التراجع.`, `Delete invoice ${invoice.invoiceNumber}? This cannot be undone.`);
        if (!confirm(msg)) return;
        for (const p of payments) await window.db.delete('payments', p.id);
        await window.db.delete('invoices', invoiceId);
        this.showToast(this.t('تم حذف الفاتورة.', 'Invoice deleted.'), 'info');
        await this.loadPatientInvoices();
        await this.refreshDashboard();
    }

    async printInvoice(invoiceId) {
        const invoice = await window.db.get('invoices', invoiceId);
        const clinic = await window.db.get('settings', 'clinic_info');
        if (!invoice) return;

        const printArea = document.getElementById('printableContent');
        printArea.innerHTML = this.buildInvoiceHTML(invoice, clinic, await this.getInvoicePayments(invoiceId));
        window.print();
    }

    async exportInvoiceToPDF(invoiceId) {
        const invoice = await window.db.get('invoices', invoiceId);
        const clinic = await window.db.get('settings', 'clinic_info');
        if (!invoice) return;

        const holder = document.createElement('div');
        holder.style.cssText = 'position:fixed; left:-9999px; top:0; width:750px; background:#fff; padding:24px; font-family:inherit;';
        holder.innerHTML = this.buildInvoiceHTML(invoice, clinic, await this.getInvoicePayments(invoiceId));
        document.body.appendChild(holder);

        try {
            const canvas = await html2canvas(holder, { scale: 2, backgroundColor: '#ffffff' });
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const imgHeight = (canvas.height * pageWidth) / canvas.width;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, imgHeight);
            pdf.save(`Invoice_${invoice.invoiceNumber}.pdf`);
        } finally {
            document.body.removeChild(holder);
        }
    }

    // Matches the clinic's actual approved letterhead: EN name/title on the
    // left, the official seal centred, AR name/title on the right, then a
    // Date line and a Name line, then the medication list underneath, and
    // the clinic's address (from Settings) at the very bottom.
    async printPrescription(rxId) {
        const rx = await window.db.get('prescriptions', rxId);
        if (!rx) return;
        document.getElementById('printableContent').innerHTML = await this.buildPrescriptionHTML(rx);
        window.print();
    }

    async exportPrescriptionToPDF(rxId) {
        const rx = await window.db.get('prescriptions', rxId);
        if (!rx) return;
        const safeName = String(rx.patientName || 'Patient').replace(/[^\w؀-ۿ-]+/g, '_');
        await this.exportPrintAreaToPDF(`Prescription_${safeName}_${rx.date}.pdf`, await this.buildPrescriptionHTML(rx));
    }

    async buildPrescriptionHTML(rx) {
        const clinic = await window.db.get('settings', 'clinic_info') || {};
        return `
            ${this.buildLetterheadHTML()}

            <div style="margin-bottom:14px; font-size:1.2rem; color:#111;">
                Date: <strong>${this.formatDateAR(rx.date)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid #333; padding-bottom:8px; margin-bottom:34px; font-size:1.2rem; color:#111;">
                <span>Name: <strong>${this.escapeHTML(rx.patientName)}</strong></span>
                <span style="direction:rtl; font-size:1.05rem;">الإسم :</span>
            </div>

            <div style="min-height:200px; margin-bottom:20px;">
                ${rx.medications.map((m, idx) => `
                    <div style="margin-bottom:16px;">
                        <div style="font-size:1.15rem; font-weight:bold; color:#111;">${idx + 1}. ${this.escapeHTML(m.name)}</div>
                        <div style="color:#444; margin-top:3px; font-size:0.95rem; padding-right:18px;">${this.escapeHTML(m.instructions)}</div>
                    </div>
                `).join('')}
            </div>

            ${rx.doctorNotes ? `<div style="margin-bottom:16px; font-style:italic; color:#333;">${this.t('ملاحظات', 'Notes')}: ${this.escapeHTML(rx.doctorNotes)}</div>` : ''}

            ${rx.xrayType ? `
            <div style="border-top:1px solid #ccc; padding-top:14px; margin-top:22px;">
                <h4 style="margin:0 0 6px 0; color:#0369a1;">Medical Prescription &amp; X-ray</h4>
                <p style="margin:0; color:#111;">${rx.xrayType}</p>
            </div>` : ''}

            <div style="margin-top:60px; text-align:left; color:#111; font-size:1.1rem;">
                <p>Doctor's Signature: _________________</p>
            </div>

            ${this.buildLetterheadFooterHTML(clinic)}
        `;
    }

    // Modal Helpers
    openModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.style.display = 'flex';
    }

    closeModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new ToothLogicApp();
    window.app.init();
});
