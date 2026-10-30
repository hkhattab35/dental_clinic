/**
 * DentFlow Pro — extra reports for Accounts & Reports:
 *   • Ortho Report   (per-patient ortho ledger over a date range)
 *   • General Report (search + filter across everything about patients)
 * Added onto the app class so they share its helpers (dates, toasts, Excel writer).
 */
Object.assign(ToothLogicApp.prototype, {

    // ==========================================
    // FULL DATABASE EXPORT (read-only Excel copy — Backup.json is what Restore uses)
    // ==========================================
    async exportFullDatabaseToExcel() {
        if (typeof ExcelJS === 'undefined') {
            this.showToast(this.t('تعذر تحميل مكتبة Excel. تأكد من الاتصال بالإنترنت وحاول مجدداً.', 'Could not load the Excel library. Check your internet connection and try again.'), 'error');
            return;
        }
        const datasets = await this.buildGeneralDatasets();
        const workbook = new ExcelJS.Workbook();
        const thin = { style: 'thin' };
        const numeric = c => c.type === 'number' || c.type === 'money';

        const usedNames = new Set();
        Object.values(datasets).forEach(d => {
            // Excel sheet names ban * ? : \ / [ ] and must be unique + ≤31 chars.
            let name = d.label.replace(/[*?:\\/[\]]/g, '-').slice(0, 31).trim() || 'Sheet';
            let i = 2;
            while (usedNames.has(name)) { const suffix = ` (${i++})`; name = name.slice(0, 31 - suffix.length) + suffix; }
            usedNames.add(name);
            const sheet = workbook.addWorksheet(name);
            sheet.addRow(d.columns.map(c => c.label));
            d.rows.forEach(r => sheet.addRow(d.columns.map(c => {
                const v = r[c.key];
                if (c.type === 'tags') return v.join(', ');
                if (c.type === 'date') return v ? this.formatDateAR(v) : '';
                if (numeric(c)) return v === '' || v == null ? '' : Number(v);
                return v ?? '';
            })));
            sheet.columns = d.columns.map(c => ({ width: Math.max(14, Math.min(34, c.label.length + 8)) }));
            sheet.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: false }, cell => {
                cell.font = { size: 16 };
                cell.border = { top: thin, left: thin, bottom: thin, right: thin };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }));
            sheet.getRow(1).eachCell({ includeEmpty: false }, cell => {
                cell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF595959' } };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `Full_Database_${this.todayISO()}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        this.showToast(this.t('تم تصدير قاعدة البيانات بنجاح.', 'Database exported successfully.'), 'success');
    },

    // ==========================================
    // ORTHO REPORT
    // ==========================================
    orthoPatientsOf(patients) {
        return patients.filter(p => (p.orthoEntries && p.orthoEntries.length) || (parseFloat(p.orthoDueAmount) || 0) > 0);
    },

    async populateOrthoReportPatients() {
        const sel = document.getElementById('orthoReportPatient');
        if (!sel) return;
        const current = sel.value || 'all';
        const list = this.orthoPatientsOf(await window.db.getAll('patients')).sort((a, b) => String(a.name).localeCompare(String(b.name)));
        sel.innerHTML = `<option value="all">All ortho patients</option>` +
            list.map(p => `<option value="${p.id}">${this.escapeHTML(p.name)} (${this.escapeHTML(p.patientCode || '')})</option>`).join('');
        sel.value = list.some(p => p.id === current) ? current : 'all';
        await this.loadOrthoSplitSettings();
        this.runOrthoReport();
    },

    // The two boxes above the report: a fixed amount that goes to DR 1 first,
    // and DR 1's percentage of every payment after that. Remembered between visits.
    getOrthoSplitSettings() {
        const fixed = Math.max(0, parseFloat(document.getElementById('orthoDr1Fixed')?.value) || 0);
        const raw = parseFloat(document.getElementById('orthoDr1Pct')?.value);
        const pct = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 35;
        return { fixed, pct };
    },

    describeOrthoSplit({ fixed, pct }) {
        const m = n => `$${(Number(n) || 0).toFixed(2)}`;
        return `${fixed > 0 ? `DR 1 takes the first ${m(fixed)} paid; then ` : ''}each payment is split DR 1 ${pct}% / DR 2 ${+(100 - pct).toFixed(2)}%`;
    },

    onOrthoSplitChanged() {
        clearTimeout(this.orthoSplitTimer);
        this.orthoSplitTimer = setTimeout(async () => {
            const s = this.getOrthoSplitSettings();
            await window.db.put('settings', { key: 'ortho_report_split', fixed: s.fixed, pct: s.pct, updatedAt: new Date().toISOString() });
            this.runOrthoReport();
        }, 250);
    },

    async loadOrthoSplitSettings() {
        const saved = await window.db.get('settings', 'ortho_report_split');
        const f = document.getElementById('orthoDr1Fixed'), p = document.getElementById('orthoDr1Pct');
        if (saved && f && p) { f.value = saved.fixed || ''; p.value = saved.pct ?? 35; }
    },
    // Builds the report rows. Remaining is always computed over ALL of a
    // patient's payments in the order they were added; the date range only
    // decides which payments are listed / counted in "Paid (period)".
    async computeOrthoReport() {
        const fromDate = this.validateDateInput('orthoReportFrom', false);
        if (fromDate === null) return null;
        const toDate = this.validateDateInput('orthoReportTo', false);
        if (toDate === null) return null;
        const selected = document.getElementById('orthoReportPatient')?.value || 'all';
        const patients = this.orthoPatientsOf(await window.db.getAll('patients'))
            .filter(p => selected === 'all' || p.id === selected)
            .sort((a, b) => String(a.name).localeCompare(String(b.name)));

        // How each patient's payments are shared (this report only; the ledger
        // itself is untouched): the first "fixed" dollars paid go entirely to
        // DR 1, then every further payment is split pct% DR 1 / rest DR 2.
        const { fixed, pct } = this.getOrthoSplitSettings();
        const round2 = n => Math.round(n * 100) / 100;
        const summary = [], details = [];
        patients.forEach(p => {
            const due = parseFloat(p.orthoDueAmount) || 0;
            let cumulative = 0, paidPeriod = 0, dr1Period = 0, dr2Period = 0, fixedLeft = fixed;
            (p.orthoEntries || []).forEach(e => {
                const paid = parseFloat(e.paid) || 0;
                cumulative += paid;
                // Shares are worked out over ALL of the patient's payments in the
                // order they were made, so the period filter never changes them.
                const toFixed = Math.min(paid, fixedLeft); fixedLeft -= toFixed;
                const dr1 = round2(toFixed + (paid - toFixed) * pct / 100), dr2 = round2(paid - dr1);
                const d = this.normalizeStoredDate(e.date);
                if ((!fromDate || d >= fromDate) && (!toDate || d <= toDate)) {
                    paidPeriod += paid; dr1Period += dr1; dr2Period += dr2;
                    details.push({ patient: p.name, code: p.patientCode, date: d, tooth: e.tooth || '--', treatment: e.treatment || '--', paid, dr1, dr2, note: e.note || '', remaining: due - cumulative });
                }
            });
            summary.push({ patient: p.name, code: p.patientCode, phone: p.phone || '--', due, paidPeriod, dr1Period, dr2Period, paidTotal: cumulative, remaining: due - cumulative });
        });
        details.sort((a, b) => a.patient.localeCompare(b.patient) || a.date.localeCompare(b.date));
        return { fromDate, toDate, summary, details, split: { fixed, pct } };
    },

    async runOrthoReport() {
        const out = document.getElementById('orthoReportOutput');
        if (!out) return;
        const data = await this.computeOrthoReport();
        if (!data) return;
        const money = n => `$${(Number(n) || 0).toFixed(2)}`;
        if (data.summary.length === 0) {
            out.innerHTML = `<div class="empty-state-row"><span class="empty-state-icon">🦷</span><span class="empty-state-text">No ortho patients yet. Open a patient file → Ortho to start a ledger.</span></div>`;
            return;
        }
        const tot = data.summary.reduce((t, s) => ({ due: t.due + s.due, dr1Period: t.dr1Period + s.dr1Period, dr2Period: t.dr2Period + s.dr2Period, paidTotal: t.paidTotal + s.paidTotal, remaining: t.remaining + s.remaining }), { due: 0, dr1Period: 0, dr2Period: 0, paidTotal: 0, remaining: 0 });
        out.innerHTML = `
            <div style="margin-bottom:12px; padding:10px 14px; background:#eff6ff; border:1px solid #93c5fd; border-radius:8px; font-weight:700;">${this.describeOrthoSplit(data.split)}</div>
            <h4 style="margin:6px 0 8px; font-weight:800;">Summary per patient</h4>
            <div class="table-responsive"><table class="two-row-head">
                <thead><tr><th rowspan="2">File No.</th><th rowspan="2">Patient</th><th rowspan="2">Phone</th><th rowspan="2">Due Amount</th><th colspan="2">Paid (period)</th><th rowspan="2">Total Paid</th><th rowspan="2">Remaining</th></tr>
                    <tr><th>DR 1</th><th>DR 2</th></tr></thead>
                <tbody>${data.summary.map(s => `<tr><td>${this.escapeHTML(s.code || '--')}</td><td><strong>${this.escapeHTML(s.patient)}</strong></td><td>${this.escapeHTML(s.phone)}</td>
                    <td>${money(s.due)}</td><td style="color:var(--success); font-weight:800;">${money(s.dr1Period)}</td><td style="color:var(--success); font-weight:800;">${money(s.dr2Period)}</td><td>${money(s.paidTotal)}</td>
                    <td style="font-weight:800; color:${s.remaining > 0.005 ? 'var(--danger)' : 'var(--success)'};">${money(s.remaining)}</td></tr>`).join('')}
                    <tr style="font-weight:800;"><td colspan="3">Total</td><td>${money(tot.due)}</td><td>${money(tot.dr1Period)}</td><td>${money(tot.dr2Period)}</td><td>${money(tot.paidTotal)}</td><td>${money(tot.remaining)}</td></tr>
                </tbody></table></div>
            <h4 style="margin:22px 0 8px; font-weight:800;">Payment details</h4>
            <div class="table-responsive"><table class="two-row-head">
                <thead><tr><th rowspan="2">Patient</th><th rowspan="2">Date</th><th rowspan="2">Tooth</th><th rowspan="2">Treatment</th><th colspan="2">Paid</th><th rowspan="2">Remaining after</th><th rowspan="2">Note</th></tr>
                    <tr><th>DR 1</th><th>DR 2</th></tr></thead>
                <tbody>${data.details.length ? data.details.map(d => `<tr><td><strong>${this.escapeHTML(d.patient)}</strong></td><td>${this.formatDateAR(d.date)}</td><td>${this.escapeHTML(d.tooth)}</td><td>${this.escapeHTML(d.treatment)}</td>
                    <td style="color:var(--success); font-weight:800;">${money(d.dr1)}</td><td style="color:var(--success); font-weight:800;">${money(d.dr2)}</td><td>${money(d.remaining)}</td><td>${d.note ? this.escapeHTML(d.note) : '--'}</td></tr>`).join('')
                    : `<tr><td colspan="8" style="padding:20px; color:var(--text-muted);">No payments in this period.</td></tr>`}</tbody></table></div>`;
    },

    // One sheet holding the whole report, laid out like the screen: the split
    // rule, the per-patient summary (with its Total row), then every payment.
    async exportOrthoReportToExcel() {
        const data = await this.computeOrthoReport();
        if (!data) return;
        if (!data.summary.length) { this.showToast('No ortho data to export.', 'info'); return; }
        if (typeof ExcelJS === 'undefined') {
            this.showToast(this.t('تعذر تحميل مكتبة Excel. تأكد من الاتصال بالإنترنت وحاول مجدداً.', 'Could not load the Excel library. Check your internet connection and try again.'), 'error');
            return;
        }
        const tot = data.summary.reduce((t, s) => ({ due: t.due + s.due, dr1: t.dr1 + s.dr1Period, dr2: t.dr2 + s.dr2Period, paid: t.paid + s.paidTotal, rem: t.rem + s.remaining }), { due: 0, dr1: 0, dr2: 0, paid: 0, rem: 0 });
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Ortho Report');
        const thin = { style: 'thin' };
        const bordered = [];                  // rows that get borders / centring
        const headerRows = [];                // rows styled as table headers
        const add = (values, kind) => { const r = sheet.addRow(values); if (kind === 'header') headerRows.push(r.number); bordered.push(r.number); return r; };
        const period = `${data.fromDate ? this.formatDateAR(data.fromDate) : 'the beginning'} → ${data.toDate ? this.formatDateAR(data.toDate) : 'today'}`;

        sheet.addRow(['Ortho Report — period: ' + period]).getCell(1).font = { size: 16, bold: true };
        sheet.addRow([this.describeOrthoSplit(data.split)]).getCell(1).font = { size: 16 };
        sheet.addRow([]);
        sheet.addRow(['Summary per patient']).getCell(1).font = { size: 16, bold: true };
        add(['File No.', 'Patient', 'Phone', 'Due Amount', 'DR 1', 'DR 2', 'Total Paid', 'Remaining'], 'header');
        data.summary.forEach(s => add([s.code || '--', s.patient, s.phone, s.due, s.dr1Period, s.dr2Period, s.paidTotal, s.remaining]));
        const totalRow = add(['Total', '', '', tot.due, tot.dr1, tot.dr2, tot.paid, tot.rem]);
        sheet.addRow([]);
        sheet.addRow(['Payment details']).getCell(1).font = { size: 16, bold: true };
        add(['Patient', 'Date', 'Tooth', 'Treatment', 'DR 1', 'DR 2', 'Remaining after', 'Note'], 'header');
        if (data.details.length) data.details.forEach(d => add([d.patient, this.formatDateAR(d.date), d.tooth, d.treatment, d.dr1, d.dr2, d.remaining, d.note || '--']));
        else add(['No payments in this period.']);

        sheet.columns = [{ width: 26 }, { width: 28 }, { width: 22 }, { width: 28 }, { width: 18 }, { width: 18 }, { width: 20 }, { width: 18 }];
        bordered.forEach(n => sheet.getRow(n).eachCell({ includeEmpty: false }, cell => {
            cell.font = { size: 16 };
            cell.border = { top: thin, left: thin, bottom: thin, right: thin };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }));
        headerRows.forEach(n => sheet.getRow(n).eachCell({ includeEmpty: false }, cell => {
            cell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF595959' } };
        }));
        totalRow.eachCell({ includeEmpty: false }, cell => { cell.font = { size: 16, bold: true }; });

        const buffer = await workbook.xlsx.writeBuffer();
        const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `Ortho_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        this.showToast(this.t('تم تصدير التقرير بنجاح.', 'Report exported successfully.'), 'success');
    },

    async printOrthoReport() {
        const data = await this.computeOrthoReport();
        if (!data) return;
        const clinic = await window.db.get('settings', 'clinic_info') || {};
        const money = n => `$${(Number(n) || 0).toFixed(2)}`;
        const c = 'border:1px solid #64748b; padding:7px 10px; text-align:center;';
        const h = `${c} background:#dbeafe; font-weight:800;`;
        const periodText = `${data.fromDate ? this.formatDateAR(data.fromDate) : 'the beginning'} → ${data.toDate ? this.formatDateAR(data.toDate) : 'today'}`;
        document.getElementById('printableContent').innerHTML = `
            ${this.buildLetterheadHTML()}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h2 style="margin:0; color:#0284c7; font-size:1.3rem;">Ortho Report</h2>
                <p style="margin:0; color:#475569; font-size:0.9rem;">Period: ${periodText}</p>
            </div>
            <p style="margin:0 0 12px 0; font-weight:700;">${this.describeOrthoSplit(data.split)}</p>
            <table style="width:100%; border-collapse:collapse; margin-bottom:22px;">
                <thead><tr><th style="${h}" rowspan="2">File No.</th><th style="${h}" rowspan="2">Patient</th><th style="${h}" rowspan="2">Due Amount</th><th style="${h}" colspan="2">Paid (period)</th><th style="${h}" rowspan="2">Total Paid</th><th style="${h}" rowspan="2">Remaining</th></tr><tr><th style="${h}">DR 1</th><th style="${h}">DR 2</th></tr></thead>
                <tbody>${data.summary.map(s => `<tr><td style="${c}">${this.escapeHTML(s.code || '--')}</td><td style="${c}"><strong>${this.escapeHTML(s.patient)}</strong></td><td style="${c}">${money(s.due)}</td><td style="${c}">${money(s.dr1Period)}</td><td style="${c}">${money(s.dr2Period)}</td><td style="${c}">${money(s.paidTotal)}</td><td style="${c}"><strong>${money(s.remaining)}</strong></td></tr>`).join('')}</tbody>
            </table>
            <table style="width:100%; border-collapse:collapse;">
                <thead><tr><th style="${h}" rowspan="2">Patient</th><th style="${h}" rowspan="2">Date</th><th style="${h}" rowspan="2">Tooth</th><th style="${h}" rowspan="2">Treatment</th><th style="${h}" colspan="2">Paid</th><th style="${h}" rowspan="2">Remaining after</th><th style="${h}" rowspan="2">Note</th></tr><tr><th style="${h}">DR 1</th><th style="${h}">DR 2</th></tr></thead>
                <tbody>${data.details.map(d => `<tr><td style="${c}">${this.escapeHTML(d.patient)}</td><td style="${c}">${this.formatDateAR(d.date)}</td><td style="${c}">${this.escapeHTML(d.tooth)}</td><td style="${c}">${this.escapeHTML(d.treatment)}</td><td style="${c}">${money(d.dr1)}</td><td style="${c}">${money(d.dr2)}</td><td style="${c}">${money(d.remaining)}</td><td style="${c}">${d.note ? this.escapeHTML(d.note) : '--'}</td></tr>`).join('') || `<tr><td colspan="8" style="${c}">No payments in this period.</td></tr>`}</tbody>
            </table>
            ${this.buildLetterheadFooterHTML(clinic)}`;
        window.print();
    },

    // ==========================================
    // GENERAL REPORT — search & filter everything about patients
    // ==========================================
    async buildGeneralDatasets() {
        const [patients, appts, invoices, payments, rxs, labs] = await Promise.all([
            window.db.getAll('patients'), window.db.getAll('appointments'), window.db.getAll('invoices'),
            window.db.getAll('payments'), window.db.getAll('prescriptions'), window.db.getAll('lab_cases')
        ]);
        const byId = new Map(patients.map(p => [p.id, p]));
        const invById = new Map(invoices.map(i => [i.id, i]));
        const D = v => (v ? this.normalizeStoredDate(v) : '');
        const who = id => { const p = byId.get(id); return { patient: p ? p.name : '--', code: p ? (p.patientCode || '') : '', phone: p ? (p.phone || '') : '' }; };
        const yesNo = v => (v ? 'Yes' : 'No');
        const alertNames = { diabetes: 'Diabetes', bp: 'Blood pressure', heart: 'Heart disease', bleeding: 'Bleeding problems', allergy: 'Drug allergy', pregnancy: 'Pregnancy / nursing', hepatitis: 'Liver / kidney', smoking: 'Smoker', cancer: 'Cancer', chemo: 'Chemotherapy' };
        const condLabel = key => { const c = TOOTH_CONDITIONS[key]; return c ? this.t(c.labelAr, c.labelEn) : (key || '--'); };
        // Group once (Maps) instead of re-scanning every list per patient/invoice:
        // that nested scan froze the app for minutes on a large clinic.
        const groupBy = (list, key) => { const m = new Map(); list.forEach(x => { const k = x[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };
        const invoicesByPatient = groupBy(invoices, 'patientId'), paymentsByPatient = groupBy(payments, 'patientId');
        const paidByInvoice = new Map();
        payments.forEach(p => paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) || 0) + (parseFloat(p.amount) || 0)));
        const paidOfInvoice = id => paidByInvoice.get(id) || 0;
        const planNet = this.buildPlanNetMap(invoices);

        const T = 'text', N = 'number', M = 'money', DT = 'date', TG = 'tags';
        const col = (key, label, type = T) => ({ key, label, type });
        const ds = {};

        ds.patients = { label: 'Patients', columns: [
            col('code', 'File No.'), col('patient', 'Patient'), col('gender', 'Gender'), col('age', 'Age', N),
            col('phone', 'Phone'), col('address', 'Address'), col('referredBy', 'Referred By'),
            col('conditions', 'Medical Conditions', TG), col('allergy', 'Allergy Details'), col('notes', 'Notes'),
            col('archived', 'Archived'),
            col('billed', 'Total Billed', M), col('paid', 'Total Paid', M), col('balance', 'Balance (owed)', M), col('procedures', 'Procedures', N), col('visits', 'Visits', N)
        ], rows: patients.map(p => {
            const inv = invoicesByPatient.get(p.id) || [], pay = paymentsByPatient.get(p.id) || [];
            const billed = inv.reduce((s, i) => s + (parseFloat(i.netTotal) || 0), 0), paid = pay.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
            return { code: p.patientCode || '', patient: p.name, gender: p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : '', age: p.age === '' || p.age == null ? '' : Number(p.age), phone: p.phone || '',
                address: p.address || '', referredBy: p.referredBy || '',
                conditions: Object.keys(p.medicalAlerts || {}).filter(k => p.medicalAlerts[k]).map(k => alertNames[k] || k), allergy: p.allergyDetails || '', notes: p.notes || '',
                archived: yesNo(p.isArchived), billed, paid, balance: billed - paid,
                procedures: (p.treatmentPlans || []).length, visits: (p.visits || []).length };
        }) };

        ds.appointments = { label: 'Appointments', columns: [
            col('date', 'Date', DT), col('time', 'Time'), col('duration', 'Duration (min)', N), col('patient', 'Patient'), col('code', 'File No.'), col('phone', 'Phone'),
            col('procedure', 'Procedure / Reason'), col('status', 'Status'), col('notes', 'Notes'), col('reminder', 'Notification')
        ], rows: appts.map(a => ({ ...who(a.patientId), date: D(a.date), time: a.time || '', duration: this.getApptDuration(a), procedure: a.procedure || '',
            status: this.getApptStatusLabel(a.status), notes: a.notes || '', reminder: yesNo(a.reminderEnabled) })) };

        ds.visits = { label: 'Clinical Sessions', columns: [
            col('date', 'Date', DT), col('patient', 'Patient'), col('code', 'File No.'), col('tooth', 'Tooth'), col('complaint', 'Chief Complaint'), col('procedure', 'Procedure Done'),
            col('notes', 'Doctor Notes'), col('nextDate', 'Next Visit Date', DT), col('nextTime', 'Next Visit Time')
        ], rows: patients.flatMap(p => (p.visits || []).map(v => ({ ...who(p.id), date: D(v.date), tooth: v.toothNum || 'General', complaint: v.chiefComplaint && v.chiefComplaint !== '--' ? v.chiefComplaint : '',
            procedure: v.procedureDone || '', notes: v.doctorNotes && v.doctorNotes !== '--' ? v.doctorNotes : '', nextDate: D(v.nextVisitDate), nextTime: v.nextVisitTime || '' }))) };

        ds.plans = { label: 'Procedures / Treatment Plans', columns: [
            col('created', 'Date', DT), col('patient', 'Patient'), col('code', 'File No.'), col('tooth', 'Tooth'), col('procedure', 'Procedure'), col('type', 'Procedure Type'),
            col('status', 'Status'), col('cost', 'Cost', M), col('notes', 'Notes')
        ], rows: patients.flatMap(p => (p.treatmentPlans || []).map(t => ({ ...who(p.id), created: D(this.planReportDate(t)), tooth: t.teeth ? `${t.teeth[0]}–${t.teeth[t.teeth.length - 1]}` : (t.toothNum || 'General'),
            procedure: t.procedure || '', type: condLabel(t.condition), status: this.getPlanStatusLabel(t.status), cost: planNet.has(t.id) ? planNet.get(t.id) : (parseFloat(t.cost) || 0), notes: t.notes || '' }))) };

        ds.invoices = { label: 'Invoices', columns: [
            col('date', 'Date', DT), col('number', 'Invoice No.'), col('patient', 'Patient'), col('code', 'File No.'), col('items', 'Items', TG),
            col('subtotal', 'Subtotal', M), col('discount', 'Discount', M), col('net', 'Net Total', M), col('paid', 'Paid', M), col('remaining', 'Remaining', M)
        ], rows: invoices.map(i => { const net = parseFloat(i.netTotal) || 0, paid = paidOfInvoice(i.id); return { ...who(i.patientId), date: D(i.date), number: i.invoiceNumber || '',
            items: (i.items || []).map(x => x.description), subtotal: parseFloat(i.subtotal) || net, discount: parseFloat(i.discount) || 0, net, paid, remaining: net - paid }; }) };

        ds.payments = { label: 'Payments', columns: [
            col('date', 'Date', DT), col('receipt', 'Receipt No.'), col('patient', 'Patient'), col('code', 'File No.'), col('invoice', 'Invoice No.'), col('amount', 'Amount', M),
            col('method', 'Method'), col('target', 'Applied To'), col('notes', 'Notes')
        ], rows: payments.map(p => ({ ...who(p.patientId), date: D(p.date), receipt: p.receiptNumber || '', invoice: invById.get(p.invoiceId)?.invoiceNumber || '', amount: parseFloat(p.amount) || 0,
            method: p.method === 'cash' ? 'Cash' : (p.method === 'card' ? 'Card' : 'Transfer'), target: p.itemLabel || '', notes: p.notes || '' })) };

        ds.prescriptions = { label: 'Prescriptions & X-ray', columns: [
            col('date', 'Date', DT), col('patient', 'Patient'), col('code', 'File No.'), col('diagnosis', 'Diagnosis'), col('meds', 'Medications', TG), col('xray', 'X-ray Type'), col('notes', 'Doctor Notes')
        ], rows: rxs.map(r => ({ ...who(r.patientId), date: D(r.date), diagnosis: r.diagnosis || '', meds: (r.medications || []).map(m => m.name), xray: r.xrayType || '', notes: r.doctorNotes || '' })) };

        ds.labs = { label: 'Lab Cases', columns: [
            col('sent', 'Sent', DT), col('number', 'Case No.'), col('patient', 'Patient'), col('code', 'File No.'), col('lab', 'Laboratory'), col('work', 'Work Type'), col('shade', 'Shade'),
            col('due', 'Expected Receipt', DT), col('cost', 'Cost', M), col('status', 'Status'), col('notes', 'Notes')
        ], rows: labs.map(c => ({ ...who(c.patientId), sent: D(c.sentDate), number: c.caseNumber || '', lab: c.labName || '', work: c.workType || '', shade: c.shade || '', due: D(c.dueDate),
            cost: parseFloat(c.cost) || 0, status: this.getLabStatusLabel(c.status), notes: c.notes || '' })) };

        ds.ortho = { label: 'Ortho Payments', columns: [
            col('date', 'Date', DT), col('patient', 'Patient'), col('code', 'File No.'), col('tooth', 'Tooth'), col('treatment', 'Treatment'), col('paid', 'Paid', M), col('remaining', 'Remaining after', M), col('due', 'Due Amount', M)
        ], rows: patients.flatMap(p => { const due = parseFloat(p.orthoDueAmount) || 0; let cum = 0;
            return (p.orthoEntries || []).map(e => { cum += parseFloat(e.paid) || 0; return { ...who(p.id), date: D(e.date), tooth: e.tooth || '', treatment: e.treatment || '', paid: parseFloat(e.paid) || 0, remaining: due - cum, due }; }); }) };

        return ds;
    },

    async openGeneralReport() {
        this.gp = this.gp || { dataset: 'patients', filters: {}, sort: null, search: '' };
        this.gpData = await this.buildGeneralDatasets();
        const sel = document.getElementById('gpDataset');
        if (sel) {
            sel.innerHTML = Object.entries(this.gpData).map(([k, d]) => `<option value="${k}">${d.label} (${d.rows.length})</option>`).join('');
            sel.value = this.gp.dataset in this.gpData ? this.gp.dataset : 'patients';
            this.gp.dataset = sel.value;
        }
        this.renderGeneralFilters();
        this.renderGeneralTable();
    },

    setGeneralDataset(key) {
        this.gp = { dataset: key, filters: {}, sort: null, search: '' };
        const s = document.getElementById('gpSearch'); if (s) s.value = '';
        this.renderGeneralFilters();
        this.renderGeneralTable();
    },

    clearGeneralFilters() { this.setGeneralDataset(this.gp.dataset); },

    // One control per column: a type-to-search drop list for text columns,
    // from/to for dates, min/max for numbers.
    renderGeneralFilters() {
        const box = document.getElementById('gpFilters');
        const d = this.gpData?.[this.gp.dataset];
        if (!box || !d) return;
        const esc = s => this.escapeHTML(String(s));
        box.innerHTML = d.columns.map(c => {
            if (c.type === 'date') return `<div class="gp-filter"><label>${c.label}</label><div class="gp-pair">
                <input type="text" inputmode="numeric" maxlength="10" placeholder="dd/mm/yyyy" class="date-input gp-date-input" data-gp="${c.key}" data-gp-part="from" title="From">
                <input type="text" inputmode="numeric" maxlength="10" placeholder="dd/mm/yyyy" class="date-input gp-date-input" data-gp="${c.key}" data-gp-part="to" title="To"></div></div>`;
            if (c.type === 'number' || c.type === 'money') return `<div class="gp-filter"><label>${c.label}</label><div class="gp-pair"><input type="number" step="any" placeholder="Min" data-gp="${c.key}" data-gp-part="min"><input type="number" step="any" placeholder="Max" data-gp="${c.key}" data-gp-part="max"></div></div>`;
            const values = new Set();
            d.rows.forEach(r => (c.type === 'tags' ? r[c.key] : [r[c.key]]).forEach(v => { if (v !== '' && v != null) values.add(String(v)); }));
            const list = values.size <= 150 ? [...values].sort((a, b) => a.localeCompare(b)) : [];
            return `<div class="gp-filter"><label>${c.label}</label><input type="text" placeholder="All — type to search" autocomplete="off" data-gp="${c.key}" data-gp-part="text" ${list.length ? `list="gpdl_${c.key}"` : ''}>${list.length ? `<datalist id="gpdl_${c.key}">${list.map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>` : ''}</div>`;
        }).join('');
        box.querySelectorAll('[data-gp]').forEach(el => {
            el.addEventListener('input', () => this.onGeneralFilterInput());
            el.addEventListener('change', () => this.onGeneralFilterInput());
        });
        // dd/mm/yyyy typing mask + calendar picker for the date filters, same as
        // every other date field in the app (the browser's own mm/dd/yyyy picker
        // otherwise shows through here, which reads wrong for an RTL Arabic clinic).
        box.querySelectorAll('.gp-date-input').forEach(el => {
            el.addEventListener('input', () => {
                let digits = el.value.replace(/\D/g, '').slice(0, 8);
                if (digits.length > 4) el.value = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                else if (digits.length > 2) el.value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                else el.value = digits;
            });
            this.attachDatePicker(el);
        });
    },

    // dd/mm/yyyy -> yyyy-mm-dd, or '' if not a valid complete date.
    parseGpDate(value) {
        const m = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!m) return '';
        const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
        const d = new Date(year, month - 1, day);
        if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return '';
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    },

    onGeneralFilterInput() {
        clearTimeout(this.gpTimer);
        this.gpTimer = setTimeout(() => this.renderGeneralTable(), 150);
    },

    getGeneralFiltered() {
        const d = this.gpData?.[this.gp.dataset];
        if (!d) return { d: null, rows: [] };
        const active = [];
        document.querySelectorAll('#gpFilters [data-gp]').forEach(el => {
            if (el.value === '') return;
            let val = el.value;
            if (el.classList.contains('gp-date-input')) { val = this.parseGpDate(el.value); if (!val) return; }
            active.push({ key: el.dataset.gp, part: el.dataset.gpPart, val });
        });
        const q = (document.getElementById('gpSearch')?.value || '').trim().toLowerCase();
        const colBy = Object.fromEntries(d.columns.map(c => [c.key, c]));
        const text = (r, c) => (c.type === 'tags' ? r[c.key].join(', ') : String(r[c.key] ?? ''));
        let rows = d.rows.filter(r => {
            for (const f of active) {
                const c = colBy[f.key], v = r[f.key];
                if (f.part === 'text') { if (!text(r, c).toLowerCase().includes(f.val.trim().toLowerCase())) return false; }
                else if (f.part === 'from') { if (!v || v < f.val) return false; }
                else if (f.part === 'to') { if (!v || v > f.val) return false; }
                else if (f.part === 'min') { if (v === '' || Number(v) < Number(f.val)) return false; }
                else if (f.part === 'max') { if (v === '' || Number(v) > Number(f.val)) return false; }
            }
            if (q && !d.columns.some(c => (c.type === 'date' ? this.formatDateAR(r[c.key]) + ' ' + r[c.key] : text(r, c)).toLowerCase().includes(q))) return false;
            return true;
        });
        const s = this.gp.sort;
        if (s) {
            const c = colBy[s.key];
            rows = [...rows].sort((a, b) => {
                const x = a[s.key], y = b[s.key];
                const cmp = (c.type === 'number' || c.type === 'money') ? (Number(x) || 0) - (Number(y) || 0) : text(a, c).localeCompare(text(b, c));
                return s.dir === 'desc' ? -cmp : cmp;
            });
        }
        return { d, rows };
    },

    formatGeneralCell(c, r) {
        const v = r[c.key];
        if (c.type === 'date') return v ? this.formatDateAR(v) : '';
        if (c.type === 'money') return `$${(Number(v) || 0).toFixed(2)}`;
        if (c.type === 'tags') return v.join(', ');
        return v === null || v === undefined ? '' : String(v);
    },

    sortGeneralBy(key) {
        const s = this.gp.sort;
        this.gp.sort = s && s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
        this.renderGeneralTable();
    },

    renderGeneralTable() {
        const { d, rows } = this.getGeneralFiltered();
        if (!d) return;
        const LIMIT = 500;
        const s = this.gp.sort;
        document.getElementById('gpHead').innerHTML = `<tr>${d.columns.map(c =>
            `<th style="cursor:pointer;" onclick="window.app.sortGeneralBy('${c.key}')" title="Click to sort">${c.label}${s && s.key === c.key ? (s.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr>`;
        document.getElementById('gpBody').innerHTML = rows.length
            ? rows.slice(0, LIMIT).map(r => `<tr>${d.columns.map(c => `<td>${this.escapeHTML(this.formatGeneralCell(c, r))}</td>`).join('')}</tr>`).join('')
            : `<tr><td colspan="${d.columns.length}" class="empty-state-row"><span class="empty-state-icon">🔎</span><span class="empty-state-text">No records match these filters.</span></td></tr>`;
        document.getElementById('gpCount').innerHTML = `<strong>${rows.length}</strong> of ${d.rows.length} records${rows.length > LIMIT ? ` — showing the first ${LIMIT} (Export to Excel includes all ${rows.length})` : ''}`;
    },

    async exportGeneralReportToExcel() {
        const { d, rows } = this.getGeneralFiltered();
        if (!d) return;
        const numeric = c => c.type === 'number' || c.type === 'money';
        await this.downloadReportExcel({
            sheetName: d.label,
            summary: [['Report', `General Report — ${d.label}`], ['Records', rows.length]],
            headers: d.columns.map(c => c.label),
            rows: rows.map(r => d.columns.map(c => numeric(c) ? (r[c.key] === '' ? '' : Number(r[c.key])) : this.formatGeneralCell(c, r))),
            widths: d.columns.map(c => Math.max(16, Math.min(40, c.label.length + 8))),
            filename: `General_Report_${d.label.replace(/[^A-Za-z]+/g, '_')}`
        });
    },

    // ==========================================
    // DUE AMOUNTS — everyone who still owes money
    // ==========================================
    // Per patient: total charged, total paid, what is still due. Invoices and the
    // Ortho ledger are separate money trails, so the "Source" box picks either
    // or both. Patients who paid in full (or overpaid) are not listed.
    async computeDueReport() {
        const source = document.getElementById('dueReportSource')?.value || 'all';
        const q = (document.getElementById('dueReportSearch')?.value || '').trim().toLowerCase();
        const [patients, invoices, payments] = await Promise.all([window.db.getAll('patients'), window.db.getAll('invoices'), window.db.getAll('payments')]);
        const sumBy = (list, key, val) => { const m = new Map(); list.forEach(x => m.set(x[key], (m.get(x[key]) || 0) + (parseFloat(val(x)) || 0))); return m; };
        const billed = sumBy(invoices, 'patientId', i => i.netTotal), paid = sumBy(payments, 'patientId', p => p.amount);
        const rows = [];
        patients.forEach(p => {
            let total = 0, paidSoFar = 0;
            if (source !== 'ortho') { total += billed.get(p.id) || 0; paidSoFar += paid.get(p.id) || 0; }
            if (source !== 'invoices') {
                total += parseFloat(p.orthoDueAmount) || 0;
                paidSoFar += (p.orthoEntries || []).reduce((s, e) => s + (parseFloat(e.paid) || 0), 0);
            }
            const due = total - paidSoFar;
            if (due <= 0.005) return;
            if (q && !`${p.name || ''} ${p.phone || ''} ${p.patientCode || ''}`.toLowerCase().includes(q)) return;
            rows.push({ id: p.id, name: p.name, phone: p.phone || '--', total, paid: paidSoFar, due });
        });
        rows.sort((a, b) => b.due - a.due);
        return { rows, source, totals: rows.reduce((t, r) => ({ total: t.total + r.total, paid: t.paid + r.paid, due: t.due + r.due }), { total: 0, paid: 0, due: 0 }) };
    },

    async runDueReport() {
        const out = document.getElementById('dueReportOutput');
        if (!out) return;
        const { rows, totals } = await this.computeDueReport();
        const money = n => `$${(Number(n) || 0).toFixed(2)}`;
        document.getElementById('dueReportCount').innerHTML = `<strong>${rows.length}</strong> patient${rows.length === 1 ? '' : 's'} with a balance — total due <strong style="color:var(--danger);">${money(totals.due)}</strong>`;
        out.innerHTML = rows.length ? `<div class="table-responsive"><table>
            <thead><tr><th>Patient</th><th>Phone</th><th>Total Amount</th><th>Paid</th><th>Due</th></tr></thead>
            <tbody>${rows.map(r => `<tr><td><a href="javascript:void(0)" onclick="window.app.openPatientProfile('${r.id}', { tab: 'account' })" style="color:var(--primary); font-weight:700;">${this.escapeHTML(r.name)}</a></td>
                <td>${this.escapeHTML(r.phone)}</td><td>${money(r.total)}</td><td style="color:var(--success); font-weight:800;">${money(r.paid)}</td><td style="color:var(--danger); font-weight:800;">${money(r.due)}</td></tr>`).join('')}
                <tr style="font-weight:800;"><td colspan="2">Total</td><td>${money(totals.total)}</td><td>${money(totals.paid)}</td><td>${money(totals.due)}</td></tr></tbody></table></div>`
            : `<div class="empty-state-row"><span class="empty-state-icon">✅</span><span class="empty-state-text">Nobody owes anything right now.</span></div>`;
    },

    async exportDueReportToExcel() {
        const { rows, totals } = await this.computeDueReport();
        if (!rows.length) { this.showToast('Nothing to export — nobody owes anything.', 'info'); return; }
        await this.downloadReportExcel({
            sheetName: 'Due Amounts',
            summary: [['Report', 'Due Amounts'], ['Patients with a balance', rows.length]],
            headers: ['Patient', 'Phone', 'Total Amount', 'Paid', 'Due'],
            rows: [...rows.map(r => [r.name, r.phone, r.total, r.paid, r.due]), ['Total', '', totals.total, totals.paid, totals.due]],
            widths: [30, 22, 20, 18, 18],
            filename: 'Due_Amounts'
        });
    },

    async printDueReport() {
        const { rows, totals } = await this.computeDueReport();
        const clinic = await window.db.get('settings', 'clinic_info') || {};
        const money = n => `$${(Number(n) || 0).toFixed(2)}`;
        const c = 'border:1px solid #64748b; padding:7px 10px; text-align:center;';
        const h = `${c} background:#dbeafe; font-weight:800;`;
        document.getElementById('printableContent').innerHTML = `
            ${this.buildLetterheadHTML()}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h2 style="margin:0; color:#0284c7; font-size:1.3rem;">Due Amounts</h2>
                <p style="margin:0; color:#475569; font-size:0.9rem;">Date: ${this.formatDateAR(this.todayISO())}</p>
            </div>
            <table style="width:100%; border-collapse:collapse;">
                <thead><tr><th style="${h}">Patient</th><th style="${h}">Phone</th><th style="${h}">Total Amount</th><th style="${h}">Paid</th><th style="${h}">Due</th></tr></thead>
                <tbody>${rows.map(r => `<tr><td style="${c}">${this.escapeHTML(r.name)}</td><td style="${c}">${this.escapeHTML(r.phone)}</td><td style="${c}">${money(r.total)}</td><td style="${c}">${money(r.paid)}</td><td style="${c}"><strong>${money(r.due)}</strong></td></tr>`).join('')}
                    <tr style="font-weight:800;"><td style="${c}" colspan="2">Total</td><td style="${c}">${money(totals.total)}</td><td style="${c}">${money(totals.paid)}</td><td style="${c}">${money(totals.due)}</td></tr></tbody>
            </table>
            ${this.buildLetterheadFooterHTML(clinic)}`;
        window.print();
    },

    // ==========================================
    // CREDIT ON ACCOUNT — patients who paid more than they currently owe
    // (same billed-vs-paid figure as the Statement of Account / describeBalance)
    // ==========================================
    async computeCreditReport(opts = {}) {
        const q = opts.skipSearch ? '' : (document.getElementById('creditReportSearch')?.value || '').trim().toLowerCase();
        const [patients, invoices, payments] = await Promise.all([window.db.getAll('patients'), window.db.getAll('invoices'), window.db.getAll('payments')]);
        const sumBy = (list, key, val) => { const m = new Map(); list.forEach(x => m.set(x[key], (m.get(x[key]) || 0) + (parseFloat(val(x)) || 0))); return m; };
        const billed = sumBy(invoices, 'patientId', i => i.netTotal), paid = sumBy(payments, 'patientId', p => p.amount);
        const rows = [];
        patients.forEach(p => {
            const balance = (billed.get(p.id) || 0) - (paid.get(p.id) || 0);
            const credit = -balance;
            if (credit <= 0.005) return;
            if (q && !`${p.name || ''} ${p.phone || ''} ${p.patientCode || ''}`.toLowerCase().includes(q)) return;
            rows.push({ id: p.id, name: p.name, phone: p.phone || '--', credit });
        });
        rows.sort((a, b) => b.credit - a.credit);
        return { rows, totals: { credit: rows.reduce((s, r) => s + r.credit, 0) } };
    },

    async runCreditReport() {
        const out = document.getElementById('creditReportOutput');
        if (!out) return;
        const { rows, totals } = await this.computeCreditReport();
        const money = n => `$${(Number(n) || 0).toFixed(2)}`;
        document.getElementById('creditReportCount').innerHTML = `<strong>${rows.length}</strong> patient${rows.length === 1 ? '' : 's'} with credit — total <strong style="color:var(--cyan);">${money(totals.credit)}</strong>`;
        out.innerHTML = rows.length ? `<div class="table-responsive"><table>
            <thead><tr><th>Patient</th><th>Phone</th><th>Credit on Account</th></tr></thead>
            <tbody>${rows.map(r => `<tr><td><a href="javascript:void(0)" onclick="window.app.openPatientProfile('${r.id}', { tab: 'account' })" style="color:var(--primary); font-weight:700;">${this.escapeHTML(r.name)}</a></td>
                <td>${this.escapeHTML(r.phone)}</td><td style="color:var(--cyan); font-weight:800;">${money(r.credit)}</td></tr>`).join('')}
                <tr style="font-weight:800;"><td colspan="2">Total</td><td>${money(totals.credit)}</td></tr></tbody></table></div>`
            : `<div class="empty-state-row"><span class="empty-state-icon">✅</span><span class="empty-state-text">No patient currently has credit on account.</span></div>`;
    },

    async exportCreditReportToExcel() {
        const { rows, totals } = await this.computeCreditReport();
        if (!rows.length) { this.showToast('Nothing to export — no patient has credit on account.', 'info'); return; }
        await this.downloadReportExcel({
            sheetName: 'Credit on Account',
            summary: [['Report', 'Credit on Account'], ['Patients with credit', rows.length]],
            headers: ['Patient', 'Phone', 'Credit on Account'],
            rows: [...rows.map(r => [r.name, r.phone, r.credit]), ['Total', '', totals.credit]],
            widths: [30, 22, 22],
            filename: 'Credit_On_Account'
        });
    },

    async printCreditReport() {
        const { rows, totals } = await this.computeCreditReport();
        const clinic = await window.db.get('settings', 'clinic_info') || {};
        const money = n => `$${(Number(n) || 0).toFixed(2)}`;
        const c = 'border:1px solid #64748b; padding:7px 10px; text-align:center;';
        const h = `${c} background:#dbeafe; font-weight:800;`;
        document.getElementById('printableContent').innerHTML = `
            ${this.buildLetterheadHTML()}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h2 style="margin:0; color:#0284c7; font-size:1.3rem;">Credit on Account</h2>
                <p style="margin:0; color:#475569; font-size:0.9rem;">Date: ${this.formatDateAR(this.todayISO())}</p>
            </div>
            <table style="width:100%; border-collapse:collapse;">
                <thead><tr><th style="${h}">Patient</th><th style="${h}">Phone</th><th style="${h}">Credit on Account</th></tr></thead>
                <tbody>${rows.map(r => `<tr><td style="${c}">${this.escapeHTML(r.name)}</td><td style="${c}">${this.escapeHTML(r.phone)}</td><td style="${c}"><strong>${money(r.credit)}</strong></td></tr>`).join('')}
                    <tr style="font-weight:800;"><td style="${c}" colspan="2">Total</td><td style="${c}">${money(totals.credit)}</td></tr></tbody>
            </table>
            ${this.buildLetterheadFooterHTML(clinic)}`;
        window.print();
    }
});
