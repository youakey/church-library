import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Search, Plus, Trash2, Save, Upload, Download, LogOut, Settings, Unlock, X, Filter, RefreshCw, SortAsc, SortDesc, LayoutGrid, List, ImagePlus } from "lucide-react";

/**
 * Церковная библиотека — одностраничный сайт-каталог книг (RU)
 * Технологии: React + TailwindCSS + Framer Motion + Lucide Icons
 * 
 * Особенности:
 * - Два режима: Публичный (просмотр) и Админ (добавление/редактирование/удаление)
 * - Вход в админ-режим спрятан: долгий тап/удержание на заголовке ~1.2с (мобайл/ПК)
 * - Поиск, фильтр по категории (включая «Без категории»), сортировка, вид сетка/список
 * - Управление списком категорий в «Настройках» (только для админа)
 * - Импорт/экспорт JSON спрятаны в «Настройках» (только для админа)
 * - Обложки: загрузка файла (base64 в localStorage) или ссылка
 * - Цветовая тема: черно-серо-бело-бежево-молочно-пастельно-кофейная
 * - Русский интерфейс, мобильный приоритет
 * 
 * ВАЖНО: PIN хранится в localStorage — это демо для статического хостинга.
 */

// ====== Константы и утилиты ======
const STORAGE_KEY = "church-library.books.v3"; // bump версия для миграции
const PIN_KEY = "church-library.admin.pin";
const VIEW_KEY = "church-library.view.mode"; // grid | list
const CATEGORIES_KEY = "church-library.categories.v1";
const DEFAULT_PIN = "3141592";

const LONG_PRESS_MS = 1200; // удержание для входа в админ (на заголовке)

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const demoBooks = [
  { id: uid(), title: "Библия (Синодальный перевод)", author: "—", year: 1876, category: "Священное Писание", description: "Полный текст Ветхого и Нового Завета.", coverUrl: "" },
  { id: uid(), title: "Православный молитвослов", author: "—", year: 2000, category: "Богослужение", description: "Сборник основных молитв и правил.", coverUrl: "" },
  { id: uid(), title: "История Церкви", author: "Евсевий Кесарийский", year: 324, category: "История", description: "Хроника ранней Церкви от апостольских времён.", coverUrl: "" },
];

// ====== Малые компоненты ======
function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-stone-700/40 px-2 py-0.5 text-xs text-stone-300 bg-stone-800/40">
      {children}
    </span>
  );
}

function PillButton({ icon: Icon, children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-2xl border border-stone-700/40 bg-stone-900/70 backdrop-blur px-3 py-2 text-sm shadow-sm hover:shadow transition-all active:scale-[0.98] ${className}`}
      {...props}
    >
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-xl border border-stone-700/50 bg-stone-900/70 backdrop-blur px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 outline-none focus:ring-2 ring-amber-400/50 transition ${className}`}
      {...props}
    />
  );
}

function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`w-full rounded-xl border border-stone-700/50 bg-stone-900/70 px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 ring-amber-400/50 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`w-full rounded-xl border border-stone-700/50 bg-stone-900/70 px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 ring-amber-400/50 ${className}`}
      {...props}
    />
  );
}

// ====== Главный компонент ======
export default function App() {
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState({ by: "title", dir: "asc" });
  const [view, setView] = useState(localStorage.getItem(VIEW_KEY) || "grid");

  const [admin, setAdmin] = useState(false);
  const [pin, setPin] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newPin, setNewPin] = useState("");

  const [categories, setCategories] = useState(["Священное Писание", "Богослужение", "История"]);

  // Долгое удержание на заголовке для входа
  const pressTimer = useRef(null);
  function startPressTimer() { clearTimeout(pressTimer.current); pressTimer.current = setTimeout(() => setShowAuth(true), LONG_PRESS_MS); }
  function cancelPressTimer() { clearTimeout(pressTimer.current); }

  // Load initial
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setBooks(parsed.map(sanitizeBook));
      } catch { setBooks(demoBooks); }
    } else { setBooks(demoBooks); }
    const cats = localStorage.getItem(CATEGORIES_KEY);
    if (cats) { try { setCategories(JSON.parse(cats)); } catch {} }
    if (!localStorage.getItem(PIN_KEY)) { localStorage.setItem(PIN_KEY, DEFAULT_PIN); }
  }, []);

  // Persist
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(books)); }, [books]);
  useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);
  useEffect(() => { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories)); }, [categories]);

  const categoriesForFilter = useMemo(() => ["all", "none", ...categories], [categories]);

  const filtered = useMemo(() => {
    let list = [...books];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((b) => [b.title, b.author, b.category, b.description]
        .filter(Boolean).some((v) => v.toString().toLowerCase().includes(q)));
    }
    if (categoryFilter !== "all") {
      if (categoryFilter === "none") list = list.filter((b) => !b.category);
      else list = list.filter((b) => b.category === categoryFilter);
    }
    list.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.by === "year") {
        const av = Number.isFinite(+a.year) ? +a.year : Infinity;
        const bv = Number.isFinite(+b.year) ? +b.year : Infinity;
        return (av - bv) * dir;
      }
      const av = (a[sort.by] ?? "").toString().toLowerCase();
      const bv = (b[sort.by] ?? "").toString().toLowerCase();
      if (av < bv) return -1 * dir; if (av > bv) return 1 * dir; return 0;
    });
    return list;
  }, [books, query, categoryFilter, sort]);

  // Книги CRUD
  function handleAdd() {
    const empty = { id: uid(), title: "", author: "", year: new Date().getFullYear(), category: "", description: "", coverUrl: "" };
    setBooks((x) => [empty, ...x]);
  }
  function handleDelete(id) { setBooks((x) => x.filter((b) => b.id !== id)); }
  function handleUpdate(id, patch) { setBooks((x) => x.map((b) => (b.id === id ? sanitizeBook({ ...b, ...patch }) : b))); }

  // Импорт/экспорт (в настройках)
  function handleExport() {
    const blob = new Blob([JSON.stringify(books, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `church-library-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }
  function handleImport(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(String(e.target?.result || "[]"));
        if (Array.isArray(data)) setBooks(data.map(sanitizeBook));
      } catch { alert("Не удалось импортировать JSON"); }
    };
    reader.readAsText(file);
  }

  // Админ вход/выход
  function tryLogin() {
    const saved = localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
    if (pin === saved) { setAdmin(true); setShowAuth(false); setPin(""); }
    else { alert("Неверный PIN"); }
  }
  function logout() { setAdmin(false); }

  // PIN сохранить
  function saveNewPin() {
    if (!newPin || newPin.length < 4) { alert("PIN не короче 4 символов"); return; }
    localStorage.setItem(PIN_KEY, newPin); setNewPin(""); alert("PIN обновлён");
  }

  // Категории управление
  const [newCat, setNewCat] = useState("");
  function addCategory() {
    const c = newCat.trim();
    if (!c) return; if (categories.includes(c)) { setNewCat(""); return; }
    setCategories((arr) => [...arr, c]); setNewCat("");
  }
  function removeCategory(c) {
    setCategories((arr) => arr.filter((x) => x !== c));
    setBooks((bs) => bs.map((b) => (b.category === c ? { ...b, category: "" } : b)));
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(245, 222, 179,0.08),transparent_60%),linear-gradient(to_bottom,rgba(17,17,17,1),rgba(24,20,16,0.95))] text-stone-100">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-stone-950/60 bg-stone-950/80 border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <motion.div
            onPointerDown={startPressTimer}
            onPointerUp={cancelPressTimer}
            onPointerCancel={cancelPressTimer}
            onPointerLeave={cancelPressTimer}
            initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="flex items-center gap-3 select-none"
          >
            <div className="h-10 w-10 rounded-2xl bg-amber-500/15 flex items-center justify-center shadow-inner">
              <BookOpen className="text-amber-200" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold leading-tight">Церковная библиотека</h1>
            </div>
          </motion.div>

          <div className="ml-auto flex items-center gap-2">
            {/* Search (desktop) */}
            <div className="hidden md:flex items-center gap-2 bg-stone-900/60 border border-stone-700/40 rounded-2xl px-3 py-2">
              <Search size={16} className="text-stone-400" />
              <input
                placeholder="Поиск по названию, автору, категории…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent outline-none text-sm placeholder:text-stone-500 w-64"
              />
            </div>

            <PillButton icon={Filter} onClick={() => document.getElementById("filters")?.scrollIntoView({ behavior: "smooth" })}>
              Фильтры
            </PillButton>

            <PillButton icon={view === "grid" ? LayoutGrid : List} onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}>
              Вид
            </PillButton>

            {admin && (
              <>
                <PillButton icon={Settings} onClick={() => setSettingsOpen(true)}>Настройки</PillButton>
                <PillButton icon={LogOut} onClick={logout}>Выйти</PillButton>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Toolbar (mobile search) */}
      <div className="md:hidden mx-auto max-w-7xl px-4 mt-4">
        <div className="flex items-center gap-2 bg-stone-900/60 border border-stone-700/40 rounded-2xl px-3 py-2">
          <Search size={16} className="text-stone-400" />
          <input
            placeholder="Поиск по названию, автору, категории…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent outline-none text-sm placeholder:text-stone-500 w-full"
          />
        </div>
      </div>

      {/* Filters row */}
      <section id="filters" className="mx-auto max-w-7xl px-4 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="col-span-1">
            <label className="text-xs text-stone-400">Категория</label>
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              {categoriesForFilter.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "Все" : c === "none" ? "Без категории" : c}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-span-1">
            <label className="text-xs text-stone-400">Сортировка</label>
            <div className="flex gap-2">
              <Select value={sort.by} onChange={(e) => setSort((s) => ({ ...s, by: e.target.value }))}>
                <option value="title">Название</option>
                <option value="author">Автор</option>
                <option value="year">Год</option>
                <option value="category">Категория</option>
              </Select>
              <button
                className="rounded-xl border border-stone-700/40 px-3 py-2 hover:bg-stone-900/60"
                onClick={() => setSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }))}
                title="Изменить направление"
              >
                {sort.dir === "asc" ? <SortAsc size={18} /> : <SortDesc size={18} />}
              </button>
            </div>
          </div>

          <div className="col-span-2 flex items-end justify-end gap-2">
            {admin && (
              <PillButton icon={Plus} onClick={handleAdd} className="bg-amber-500/20 border-amber-400/30 hover:bg-amber-500/30">Добавить книгу</PillButton>
            )}
          </div>
        </div>
      </section>

      {/* Results */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {filtered.length === 0 ? (
          <div className="text-center text-stone-400 py-20">Ничего не найдено…</div>
        ) : view === "grid" ? (
          <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {filtered.map((b) => (
                <motion.div
                  key={b.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="group rounded-2xl border border-stone-700/40 bg-stone-900/50 hover:bg-stone-900/70 transition overflow-hidden shadow-sm"
                >
                  <div className="aspect-[3/2] bg-gradient-to-br from-stone-900/40 to-stone-800/30 relative">
                    {b.coverUrl ? (
                      <img src={b.coverUrl} alt={b.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="opacity-30" size={48} />
                      </div>
                    )}
                    {!!b.category && (
                      <div className="absolute left-3 top-3 flex gap-2">
                        <Badge>{b.category}</Badge>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    {admin ? (
                      <EditableBook b={b} categories={categories} onChange={handleUpdate} onDelete={handleDelete} />
                    ) : (
                      <ReadOnlyBook b={b} />
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div layout className="divide-y divide-stone-800 rounded-2xl border border-stone-700/40 bg-stone-900/50">
            <AnimatePresence>
              {filtered.map((b) => (
                <motion.div key={b.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
                  {admin ? (
                    <EditableBook b={b} categories={categories} onChange={handleUpdate} onDelete={handleDelete} compact />
                  ) : (
                    <ReadOnlyBook b={b} compact />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Auth modal (скрытый вход) */}
      <AnimatePresence>
        {showAuth && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="w-full max-w-sm rounded-2xl border border-stone-700/40 bg-stone-950 p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Unlock size={18}/> Вход администратора</h3>
                <button className="p-1 rounded-lg hover:bg-stone-900" onClick={() => setShowAuth(false)}><X size={18} /></button>
              </div>
              <Input placeholder="PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
              <div className="mt-4 flex justify-end gap-2">
                <PillButton onClick={() => setShowAuth(false)}>Отмена</PillButton>
                <PillButton className="bg-amber-500/20 border-amber-400/30 hover:bg-amber-500/30" onClick={tryLogin}>Войти</PillButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings modal (только для админа) */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="w-full max-w-2xl rounded-2xl border border-stone-700/40 bg-stone-950 p-5 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Settings size={18}/> Настройки</h3>
                <button className="p-1 rounded-lg hover:bg-stone-900" onClick={() => setSettingsOpen(false)}><X size={18} /></button>
              </div>

              {/* PIN */}
              <div className="grid gap-2">
                <div className="text-sm font-medium">PIN администратора</div>
                <div className="text-xs text-stone-400">По умолчанию: <span className="font-mono">{DEFAULT_PIN}</span>. Рекомендуется сменить.</div>
                <div className="flex gap-2">
                  <Input value={newPin} onChange={(e)=>setNewPin(e.target.value)} placeholder="минимум 4 символа" />
                  <PillButton onClick={saveNewPin}>Сохранить</PillButton>
                </div>
              </div>

              {/* Категории */}
              <div className="grid gap-2">
                <div className="text-sm font-medium">Категории каталога</div>
                <div className="text-xs text-stone-400">Добавляйте/удаляйте. Удаление не трогает книги, но очищает поле у тех, где была эта категория.</div>
                <div className="flex gap-2">
                  <Input value={newCat} onChange={(e)=>setNewCat(e.target.value)} placeholder="Новая категория" />
                  <PillButton onClick={addCategory}>Добавить</PillButton>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c)=> (
                    <span key={c} className="inline-flex items-center gap-2 rounded-xl border border-stone-700/40 px-3 py-1 text-sm">
                      {c}
                      <button className="text-stone-400 hover:text-red-300" onClick={()=>removeCategory(c)} title="Удалить">✕</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Импорт/экспорт */}
              <div className="grid gap-2">
                <div className="text-sm font-medium">Резервное копирование</div>
                <div className="text-xs text-stone-400">Импорт и экспорт базы в JSON. (Локальное хранение в браузере)</div>
                <div className="flex flex-wrap gap-2">
                  <label className="relative overflow-hidden">
                    <input type="file" accept="application/json" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
                    <PillButton icon={Upload}>Импорт JSON</PillButton>
                  </label>
                  <PillButton icon={Download} onClick={handleExport}>Экспорт JSON</PillButton>
                  <PillButton icon={RefreshCw} onClick={() => setBooks(demoBooks)}>Сброс на демо</PillButton>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* footer intentionally empty */}
    </div>
  );
}

function ReadOnlyBook({ b, compact=false }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight truncate" title={b.title || "Без названия"}>{b.title || <span className="opacity-50">Без названия</span>}</h3>
          <div className="text-sm text-stone-400 truncate" title={`${b.author || "Автор неизвестен"}${b.year?` • ${b.year}`:""}`}>
            {b.author || "Автор неизвестен"} {Number.isFinite(+b.year) ? `• ${b.year}` : null}
          </div>
        </div>
      </div>
      {b.description && <div className="text-sm text-stone-300/90 line-clamp-3">{b.description}</div>}
      <div className="flex flex-wrap gap-2 pt-1">
        {!!b.category && <Badge>{b.category}</Badge>}
      </div>
    </div>
  );
}

function EditableBook({ b, onChange, onDelete, categories, compact=false }) {
  const [local, setLocal] = useState(b);
  useEffect(()=>{ setLocal(b); }, [b]);

  function commit() { onChange(b.id, local); }

  // Загрузка изображения как base64 (устойчиво и явно)
  const fileRef = useRef(null);
  function handleCoverFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = String(e.target?.result || "");
      setLocal((l) => ({ ...l, coverUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  function onYearChange(e){
    const v = e.target.value;
    const n = v === "" ? "" : parseInt(v, 10);
    setLocal({...local, year: Number.isNaN(n) ? "" : n});
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Input value={local.title} onChange={(e)=>setLocal({...local, title:e.target.value})} placeholder="Название" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={local.author} onChange={(e)=>setLocal({...local, author:e.target.value})} placeholder="Автор" />
            <Input type="number" value={local.year} onChange={onYearChange} placeholder="Год" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={local.category} onChange={(e)=>setLocal({...local, category:e.target.value})}>
              <option value="">— без категории —</option>
              {categories.map((c)=> <option key={c} value={c}>{c}</option>)}
            </Select>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e)=>handleCoverFile(e.target.files?.[0])} />
              <PillButton icon={ImagePlus} onClick={()=>fileRef.current?.click()}>Добавить обложку</PillButton>
            </div>
          </div>
          <Textarea rows={compact?2:3} value={local.description} onChange={(e)=>setLocal({...local, description:e.target.value})} placeholder="Краткое описание" />
          <Input value={local.coverUrl} onChange={(e)=>setLocal({...local, coverUrl:e.target.value})} placeholder="Ссылка на обложку (необязательно)" />
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <PillButton icon={Save} onClick={commit}>Сохранить</PillButton>
          <PillButton icon={Trash2} className="hover:bg-red-500/20 border-red-500/30" onClick={()=> onDelete(b.id)}>Удалить</PillButton>
        </div>
      </div>
    </div>
  );
}

// ====== Вспомогательное — санитация книги ======
function sanitizeBook(raw){
  const b = { ...raw };
  b.id = b.id || uid();
  b.title = (b.title ?? "").toString();
  b.author = (b.author ?? "").toString();
  b.description = (b.description ?? "").toString();
  b.category = (b.category ?? "").toString();
  const y = parseInt(b.year, 10);
  b.year = Number.isFinite(y) ? y : "";
  b.coverUrl = (b.coverUrl ?? "").toString();
  return b;
}
