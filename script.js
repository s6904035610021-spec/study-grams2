'use strict';

/**
 * script.js — Flashcards + Calendar + Daily Stress Tracker
 * ข้อมูลทั้งหมดเก็บใน localStorage (ไม่หายเมื่อ Refresh)
 *
 * โครงสร้าง:
 *   1. Config & Helpers   ค่าคงที่ ตัวช่วยจัดการ storage และวันที่
 *   2. Flashcards         เพิ่ม/ลบ/พลิก/ถัดไป/ย้อนกลับ
 *   3. Calendar + Stress  ปฏิทิน เลือกวัน บันทึกระดับความเครียดและข้อความ ประวัติย้อนหลัง
 *   4. Bootstrap          เริ่มทำงานเมื่อ DOM พร้อม
 */

document.addEventListener('DOMContentLoaded', () => {
  /* =========================================================
   * 1. CONFIG & HELPERS
   * ======================================================= */
  const KEYS = { cards: 'hub_cards', days: 'hub_days' };

  // ระดับความเครียด 1-5 (ใช้สร้างปุ่มเลือกและสัญลักษณ์บนปฏิทิน)
  const MOODS = [
    { lv: 1, icon: '😌', label: 'ผ่อนคลาย' },
    { lv: 2, icon: '🙂', label: 'สบายดี' },
    { lv: 3, icon: '😐', label: 'เฉยๆ' },
    { lv: 4, icon: '😟', label: 'เครียด' },
    { lv: 5, icon: '😣', label: 'เครียดมาก' },
  ];
  const moodOf = (lv) => MOODS.find((m) => m.lv === lv);

  // localStorage แบบปลอดภัย: อ่าน JSON เสียหรือถูกบล็อกก็ไม่ทำให้แอปพัง
  const store = {
    get(key, fallback) {
      try {
        const v = JSON.parse(localStorage.getItem(key));
        return v ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        console.warn('บันทึกข้อมูลไม่สำเร็จ:', err);
      }
    },
  };

  const $ = (id) => document.getElementById(id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const pad = (n) => String(n).padStart(2, '0');

  // วันที่ใช้รูปแบบ "YYYY-MM-DD" ตามเวลาท้องถิ่น เป็น key ของข้อมูลรายวัน
  const toKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const todayKey = () => {
    const n = new Date();
    return toKey(n.getFullYear(), n.getMonth(), n.getDate());
  };
  const keyToDate = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const longDate = (key) =>
    keyToDate(key).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shortDate = (key) => keyToDate(key).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

  /* =========================================================
   * 2. FLASHCARDS
   * ข้อมูล: [{ id, q, a }]
   * ======================================================= */
  const Flash = {
    cards: store.get(KEYS.cards, []),
    index: 0,

    save() {
      store.set(KEYS.cards, this.cards);
    },

    init() {
      $('card-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const q = $('card-question').value.trim();
        const a = $('card-answer').value.trim();
        if (!q || !a) return;
        this.cards.push({ id: uid(), q, a });
        this.save();
        this.index = this.cards.length - 1; // ไปที่การ์ดที่เพิ่งเพิ่ม
        e.target.reset();
        $('card-question').focus();
        this.render();
      });

      const card = $('flashcard');
      card.addEventListener('click', () => this.flip());
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.flip();
        }
      });
      $('btn-prev').addEventListener('click', () => this.move(-1));
      $('btn-next').addEventListener('click', () => this.move(1));
      $('btn-delete-card').addEventListener('click', () => this.remove());
      this.render();
    },

    flip() {
      if (this.cards.length) $('flashcard').classList.toggle('flipped');
    },

    move(step) {
      const n = this.cards.length;
      if (!n) return;
      this.index = (this.index + step + n) % n; // วนกลับต้น/ท้ายได้
      this.render();
    },

    remove() {
      const card = this.cards[this.index];
      if (!card || !confirm('ลบการ์ดใบนี้?')) return;
      this.cards = this.cards.filter((c) => c.id !== card.id);
      this.save();
      this.render();
    },

    render() {
      const n = this.cards.length;
      $('card-empty').hidden = n > 0;
      $('card-viewer').hidden = n === 0;
      if (!n) return;

      this.index = Math.min(this.index, n - 1);
      const { q, a } = this.cards[this.index];
      const el = $('flashcard');
      const paint = () => {
        $('card-front').textContent = q;
        $('card-back').textContent = a;
      };
      // ถ้าการ์ดพลิกอยู่ ให้พลิกกลับก่อนแล้วค่อยเปลี่ยนข้อความ กันเห็นเฉลยของใบถัดไปวูบเดียว
      if (el.classList.contains('flipped')) {
        el.classList.remove('flipped');
        setTimeout(paint, 250);
      } else {
        paint();
      }
      $('card-counter').textContent = `${this.index + 1} / ${n}`;
    },
  };

  /* =========================================================
   * 3. CALENDAR + STRESS TRACKER
   * ข้อมูล: { "YYYY-MM-DD": { level: 0-5, note: "..." } }
   * (level 0 = ยังไม่เลือกระดับ แต่มีบันทึกข้อความ)
   * ======================================================= */
  const Cal = {
    days: store.get(KEYS.days, {}),
    view: { y: new Date().getFullYear(), m: new Date().getMonth() },
    selected: todayKey(),
    mood: 0, // ระดับที่เลือกอยู่ในแผงบันทึก (ยังไม่กดบันทึก)

    save() {
      store.set(KEYS.days, this.days);
    },

    init() {
      this.buildMoodButtons();

      $('btn-prev-month').addEventListener('click', () => this.shiftMonth(-1));
      $('btn-next-month').addEventListener('click', () => this.shiftMonth(1));
      $('btn-today').addEventListener('click', () => this.select(todayKey()));

      // Event delegation: คลิกวันในปฏิทิน / รายการในประวัติ
      const pick = (e) => {
        const btn = e.target.closest('[data-date]');
        if (btn) this.select(btn.dataset.date);
      };
      $('cal-grid').addEventListener('click', pick);
      $('stress-history').addEventListener('click', pick);

      $('btn-save-day').addEventListener('click', () => this.saveDay());
      $('btn-clear-day').addEventListener('click', () => this.clearDay());
      this.select(this.selected);
    },

    // สร้างปุ่มเลือกระดับความเครียดจาก MOODS
    buildMoodButtons() {
      const box = $('stress-options');
      box.replaceChildren();
      MOODS.forEach(({ lv, icon, label }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mood-btn';
        btn.dataset.level = lv;
        btn.setAttribute('aria-pressed', 'false');
        btn.textContent = `${icon} ${label}`;
        btn.addEventListener('click', () => {
          this.mood = this.mood === lv ? 0 : lv; // กดซ้ำเพื่อยกเลิก
          this.renderMoodButtons();
        });
        box.append(btn);
      });
    },

    shiftMonth(step) {
      const d = new Date(this.view.y, this.view.m + step, 1);
      this.view = { y: d.getFullYear(), m: d.getMonth() };
      this.renderCalendar();
    },

    // เลือกวัน: เลื่อนปฏิทินไปเดือนนั้น แล้วโหลดข้อมูลของวันมาแสดงในแผงบันทึก
    select(key) {
      const d = keyToDate(key);
      this.selected = key;
      this.view = { y: d.getFullYear(), m: d.getMonth() };
      const entry = this.days[key];
      this.mood = entry?.level || 0;
      $('day-note').value = entry?.note || '';
      $('selected-date-label').textContent = longDate(key);
      $('save-msg').textContent = '';
      this.renderMoodButtons();
      this.renderCalendar();
      this.renderHistory();
    },

    saveDay() {
      const note = $('day-note').value.trim();
      if (!this.mood && !note) {
        $('save-msg').textContent = 'เลือกระดับความเครียดหรือพิมพ์บันทึกก่อนบันทึก';
        return;
      }
      this.days[this.selected] = { level: this.mood, note };
      this.save();
      this.renderCalendar();
      this.renderHistory();
      $('save-msg').textContent = 'บันทึกแล้ว';
    },

    clearDay() {
      if (!this.days[this.selected] || !confirm('ลบบันทึกของวันนี้?')) return;
      delete this.days[this.selected];
      this.save();
      this.select(this.selected);
      $('save-msg').textContent = 'ลบแล้ว';
    },

    renderMoodButtons() {
      $('stress-options').querySelectorAll('.mood-btn').forEach((b) =>
        b.setAttribute('aria-pressed', String(Number(b.dataset.level) === this.mood))
      );
    },

    // วาดตารางเดือน: ช่องว่างนำหน้าให้ตรงวันในสัปดาห์ (อาทิตย์ = คอลัมน์แรก)
    renderCalendar() {
      const { y, m } = this.view;
      const today = todayKey();
      $('cal-title').textContent = new Date(y, m, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

      const frag = document.createDocumentFragment();
      const offset = new Date(y, m, 1).getDay();
      for (let i = 0; i < offset; i++) {
        const blank = document.createElement('div');
        blank.className = 'cal-cell empty';
        frag.append(blank);
      }

      const total = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= total; d++) {
        const key = toKey(y, m, d);
        const entry = this.days[key];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.date = key;
        btn.className = 'cal-cell';
        if (key === today) btn.classList.add('today'); // ไฮไลท์วันนี้
        if (key === this.selected) btn.classList.add('selected');
        if (entry?.level) btn.classList.add(`level-${entry.level}`); // ใช้ระบายสีตามระดับ
        if (entry?.note) btn.classList.add('has-note');
        if (key === today) btn.setAttribute('aria-current', 'date');
        btn.setAttribute('aria-label', longDate(key));

        const num = document.createElement('span');
        num.className = 'cal-day';
        num.textContent = d;
        btn.append(num);
        if (entry?.level) {
          const icon = document.createElement('span');
          icon.className = 'cal-mood';
          icon.textContent = moodOf(entry.level).icon; // สัญลักษณ์อารมณ์บนปฏิทิน
          btn.append(icon);
        }
        frag.append(btn);
      }
      $('cal-grid').replaceChildren(frag);
    },

    // ประวัติล่าสุด 10 วัน + ค่าเฉลี่ยระดับความเครียดของ 7 วันล่าสุดที่มีข้อมูล
    renderHistory() {
      const keys = Object.keys(this.days).sort().reverse();
      const list = $('stress-history');
      list.replaceChildren();

      keys.slice(0, 10).forEach((key) => {
        const { level, note } = this.days[key];
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.date = key;
        const mood = level ? `${moodOf(level).icon} ${moodOf(level).label}` : 'ไม่ได้ระบุระดับ';
        btn.textContent = `${shortDate(key)}  ${mood}${note ? ' · ' + note.slice(0, 40) : ''}`;
        li.append(btn);
        list.append(li);
      });
      if (!keys.length) {
        const li = document.createElement('li');
        li.textContent = 'ยังไม่มีบันทึก เลือกวันในปฏิทินแล้วเริ่มบันทึกได้เลย';
        list.append(li);
      }

      const levels = keys.slice(0, 7).map((k) => this.days[k].level).filter(Boolean);
      $('stress-summary').textContent = levels.length
        ? `ค่าเฉลี่ยล่าสุด ${(levels.reduce((s, v) => s + v, 0) / levels.length).toFixed(1)} จาก 5 (${levels.length} วัน)`
        : '';
    },
  };

  /* =========================================================
   * 4. BOOTSTRAP
   * ======================================================= */
  Flash.init();
  Cal.init();
});
