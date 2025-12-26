
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';
// Use @firebase scope for more reliable named export resolution in some environments
import { initializeApp } from '@firebase/app';
import { getFirestore, doc, onSnapshot, setDoc } from '@firebase/firestore';
import { 
  Calendar, ShoppingBag, Plane, Sun, Plus, Trash2, X, Utensils, 
  BedDouble, Sparkles, List, ReceiptText, 
  Camera, MapPin, ChevronRight, Train, RefreshCw,
  Settings, Snowflake, Scale, AlertCircle, CheckCircle2,
  Edit3, Users, Minus, ChevronDown, Clock, TrendingUp, Ticket, Download, FileText, CreditCard,
  Car, Footprints, Bus, Navigation, BookmarkCheck, Bookmark, Banknote, ImageIcon, Link as LinkIcon, ShieldAlert, ShieldCheck, CloudOff, Cloud, DollarSign,
  MapPinned, Coffee, Pizza, Soup, IceCream, Baby, User, Heart, Search, Eye, Map, ArrowRightLeft, ArrowRight, Timer, File, ExternalLink
} from 'lucide-react';

// ############################################################
// #### Firebase 配置 ####
// ############################################################
const firebaseConfig = {
  apiKey: "AIzaSyBitaCyaxo6ESL6d2D1sRhU9tbAqR2rY48", 
  authDomain: "hokkaido-trip-2026.firebaseapp.com",
  projectId: "hokkaido-trip-2026", 
  storageBucket: "hokkaido-trip-2026.appspot.com",
  messagingSenderId: "727885069088",
  appId: "1:727885069088:web:72489a251b62280924f545" 
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const TRIP_DOC_ID = 'hokkaido-main-trip-2026';

// --- 常項定義 ---
const FAMILY_HEADS = ['Sandy', '英茵'] as const;
const CORE_MEMBER_IDS = ['m1', 'm2', 'm3', 'm4', 'm5']; 
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const CATEGORY_MAP: Record<string, { icon: any, label: string, color: string, bg: string }> = {
  meetup: { icon: Users, label: '集合', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  spot: { icon: MapPinned, label: '景點', color: 'text-blue-600', bg: 'bg-blue-50' },
  transport: { icon: Train, label: '交通', color: 'text-orange-600', bg: 'bg-orange-50' },
  flight: { icon: Plane, label: '航班', color: 'text-purple-600', bg: 'bg-purple-50' },
  food: { icon: Utensils, label: '美食', color: 'text-red-600', bg: 'bg-red-50' },
  shopping: { icon: ShoppingBag, label: '購物', color: 'text-pink-600', bg: 'bg-pink-50' },
  hotel: { icon: BedDouble, label: '住宿', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  other: { icon: Calendar, label: '其他', color: 'text-gray-600', bg: 'bg-gray-50' },
};

const CATEGORY_OPTIONS: { value: SpotCategory; label: string; icon: any }[] = [
  { value: 'meetup', label: '集合', icon: Users },
  { value: 'spot', label: '景點', icon: MapPinned },
  { value: 'transport', label: '交通', icon: Train },
  { value: 'food', label: '美食', icon: Utensils },
  { value: 'hotel', label: '住宿', icon: BedDouble },
  { value: 'shopping', label: '購物', icon: ShoppingBag },
  { value: 'other', label: '其他', icon: Calendar },
];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '點心'
};

// --- 型別定義 ---
interface Member { id: string; name: string; avatar: string; customAvatar?: string; family: typeof FAMILY_HEADS[number]; }
interface ExpenseLineItem { id: string; name: string; translatedName: string; quantity: number; unitPrice: number; price: number; shares: Record<string, number>; }
type SpotCategory = 'spot' | 'transport' | 'flight' | 'food' | 'shopping' | 'hotel' | 'meetup' | 'other';
interface Expense { id: string; storeName: string; date: string; currency: 'JPY' | 'TWD'; category: SpotCategory; items: ExpenseLineItem[]; totalAmount: number; paidBy: string; paymentMethod: string; timestamp: number; }
interface AIScanItem { id: string; recordId?: string; timestamp?: number; type: 'order' | 'shop' | 'guide'; name: string; nameSub?: string; price: number; priceTW_Ref?: number; quantity: number; description?: string; features?: string; }

interface SpotLink { title: string; url: string; }

interface Spot { 
  id: string; name: string; jpName: string; enName?: string; time: string; description: string; category: SpotCategory; 
  budget?: string; mapLink?: string; images: string[]; files: { name: string; data: string; type: string }[]; 
  adultCost?: number; childCost?: number; booker?: string; isBooked?: boolean; isCashOnly?: boolean; 
  mealType?: MealType; checkIn?: string; checkOut?: string; 
  departure?: string; arrival?: string; duration?: string; hasBreakfast?: boolean; hasDinner?: boolean;
  hotelCurrency?: 'JPY' | 'TWD'; hotelPrice?: number; routeLink?: string;
  links?: SpotLink[];
}

interface DayPlan { dayNum: number; date: string; location: string; weather: 'snow' | 'sunny' | 'cloudy'; temp: string; spots: Spot[]; }
interface AppState { days: DayPlan[]; exchangeRate: number; members: Member[]; expenses: Expense[]; aiItems: AIScanItem[]; }

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((r) => { const reader = new FileReader(); reader.onloadend = () => r(reader.result as string); reader.readAsDataURL(blob); });
const parsePrice = (v: any): number => { if (typeof v === 'number') return v; if (!v) return 0; const s = String(v).replace(/,/g, ''); const num = parseFloat(s); return isNaN(num) ? 0 : num; };
const getMapSearchUrl = (n: string, j: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(n + ' ' + (j || ''))}`;
// ############################################################
// #### ExpensesTab Component (家庭為核心規範版本) ####
// ############################################################
const ExpensesTab = ({ expenses, members, exchangeRate, onUpdate, onUpdateMembers, onUpdateRate }: { 
  expenses: Expense[], members: Member[], exchangeRate: number, 
  onUpdate: (e: Expense[]) => void, onUpdateMembers: (m: Member[]) => void,
  onUpdateRate: (r: number) => void
}) => {
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<Expense | null>(null);
  const [isManagingMembers, setIsManagingMembers] = useState(false);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(String(exchangeRate));
  const [viewingMemberDetails, setViewingMemberDetails] = useState<Member | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberFamily, setNewMemberFamily] = useState<typeof FAMILY_HEADS[number]>('Sandy');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploadTarget, setAvatarUploadTarget] = useState<string | null>(null);

  const stats = useMemo(() => {
    const individualTWD: Record<string, number> = {};
    const individualDetails: Record<string, { store: string, item: string, jpItem: string, quantity: number, unitPrice: number, totalItemPrice: number, amount: number, currency: string, date: string }[]> = {};
    const familyPaidJPY: Record<string, number> = { 'Sandy': 0, '英茵': 0 };
    const familyDebtJPY: Record<string, number> = { 'Sandy': 0, '英茵': 0 };
    const familyPaidTWD: Record<string, number> = { 'Sandy': 0, '英茵': 0 };
    const familyDebtTWD: Record<string, number> = { 'Sandy': 0, '英茵': 0 };

    members.forEach(m => {
      individualTWD[m.name] = 0;
      individualDetails[m.name] = [];
    });

    expenses.forEach(exp => {
      if (exp.currency === 'JPY') {
        familyPaidJPY[exp.paidBy as 'Sandy'|'英茵'] += exp.totalAmount;
      } else {
        familyPaidTWD[exp.paidBy as 'Sandy'|'英茵'] += exp.totalAmount;
      }

      exp.items.forEach(item => {
        Object.entries(item.shares).forEach(([memberName, shareAmount]) => {
          individualDetails[memberName]?.push({
            store: exp.storeName,
            item: item.translatedName,
            jpItem: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalItemPrice: item.price,
            amount: shareAmount,
            currency: exp.currency,
            date: exp.date
          });
          const amountInTWD = exp.currency === 'JPY' ? shareAmount * exchangeRate : shareAmount;
          individualTWD[memberName] += amountInTWD;
          const member = members.find(m => m.name === memberName);
          if (member) {
            if (exp.currency === 'JPY') {
              familyDebtJPY[member.family] += shareAmount;
            } else {
              familyDebtTWD[member.family] += shareAmount;
            }
          }
        });
      });
    });

    return { individualTWD, familyPaidJPY, familyDebtJPY, familyPaidTWD, familyDebtTWD, individualDetails };
  }, [expenses, members, exchangeRate]);

  const netJPY = stats.familyPaidJPY['Sandy'] - stats.familyDebtJPY['Sandy'];
  const netTWD = stats.familyPaidTWD['Sandy'] - stats.familyDebtTWD['Sandy'];

  const handleExport = () => {
    if (expenses.length === 0) return alert("尚無消費紀錄可供匯出。");
    const BOM = '\uFEFF';
    let csv = BOM;
    csv += `"Hokkaido Winter 2026 - 旅行消費明細"\n`;
    csv += `"匯率基準: 1 JPY = ${exchangeRate} TWD"\n`;
    csv += `"匯出時間: ${new Date().toLocaleString()}"\n\n`;
    const memberNames = members.map(m => m.name);
    let header = `"日期","商店","分類","支付人","支付方式","幣別","品項(中文)","品項(日文原文)","單價","數量","品項小計"`;
    memberNames.forEach(name => { header += `,"${name}"`; });
    csv += header + '\n';
    const sortedExpenses = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
    sortedExpenses.forEach(exp => {
      const categoryLabel = CATEGORY_MAP[exp.category || 'other'].label;
      exp.items.forEach(item => {
        let row = [exp.date, exp.storeName, categoryLabel, exp.paidBy, exp.paymentMethod || '未指定', exp.currency, item.translatedName, item.name, item.unitPrice, item.quantity, item.price].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
        memberNames.forEach(name => { row += `,"${item.shares[name] || 0}"`; });
        csv += row + '\n';
      });
    });
    csv += `\n"個人結算明細"\n`;
    csv += `"姓名","項目名稱","日期","幣別","分攤金額"\n`;
    memberNames.forEach(name => {
      const details = stats.individualDetails[name] || [];
      let memberJpySum = 0, memberTwdSum = 0;
      details.forEach(det => {
        csv += `"${name}","${det.item} (${det.store})","${det.date}","${det.currency}","${det.amount}"\n`;
        if (det.currency === 'JPY') memberJpySum += det.amount; else memberTwdSum += det.amount;
      });
      csv += `"${name}","合計 (JPY)","","¥","${memberJpySum.toLocaleString()}"\n`;
      csv += `"${name}","合計 (TWD)","","$","${memberTwdSum.toLocaleString()}"\n\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Hokkaido_Expenses_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (members.length === 0) { alert("請先建立成員清單。"); return; }
    setLoading(true);
    try {
      const base64Str = await blobToBase64(file);
      const data = base64Str.split(',')[1];
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `辨識收據照片。提取商店名稱(storeName)、日期(date: YYYY-MM-DD)、總額(total)、支付方式(paymentMethod: 如信用卡、現金、IC卡、PayPay等)及品項陣列(items)。品項包含：name(日文原文), translatedName(繁體中文翻譯), quantity(數量), unitPrice(單價), price(項目總額)。請以 JSON 回傳。嚴禁英文。`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ inlineData: { data, mimeType: file.type } }, { text: prompt }] },
        config: { responseMimeType: "application/json" }
      });
      const parsed = JSON.parse(response.text.trim());
      const payerName = members[0]?.name || 'Sandy';
      const newExp: Expense = {
        id: `exp-${Date.now()}`,
        storeName: parsed.storeName || "新消費",
        date: parsed.date || new Date().toISOString().split('T')[0],
        currency: 'JPY',
        category: 'shopping',
        items: (parsed.items || []).map((i: any, idx: number) => {
          const itemPrice = parsePrice(i.price);
          return { id: `item-${idx}`, name: i.name || "原文品名", translatedName: i.translatedName || "中文品名", quantity: parsePrice(i.quantity) || 1, unitPrice: parsePrice(i.unitPrice), price: itemPrice, shares: { [payerName]: itemPrice } };
        }),
        totalAmount: parsePrice(parsed.total),
        paidBy: payerName,
        paymentMethod: parsed.paymentMethod || '信用卡',
        timestamp: Date.now()
      };
      setShowConfirmModal(newExp);
    } catch (err) { alert("辨識失敗。"); } finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleManualEntry = () => {
    const payerName = members[0]?.name || 'Sandy';
    setShowConfirmModal({
      id: `exp-${Date.now()}`,
      storeName: "手動記帳",
      date: new Date().toISOString().split('T')[0],
      currency: 'JPY',
      category: 'other',
      items: [{ id: 'item-0', name: '原文品名', translatedName: '新項目', quantity: 1, unitPrice: 0, price: 0, shares: { [payerName]: 0 } }],
      totalAmount: 0,
      paidBy: payerName,
      paymentMethod: '現金',
      timestamp: Date.now()
    });
  };

  const handleToggleMemberShare = (itemIdx: number, memberName: string) => {
    if (!showConfirmModal) return;
    const next = { ...showConfirmModal };
    const item = next.items[itemIdx];
    if (item.shares[memberName] !== undefined) delete item.shares[memberName];
    else item.shares[memberName] = 0;
    const participants = Object.keys(item.shares);
    if (participants.length > 0) {
      const share = Math.floor(item.price / participants.length);
      const remainder = item.price % participants.length;
      participants.forEach((p, i) => { item.shares[p] = share + (i === 0 ? remainder : 0); });
    }
    setShowConfirmModal(next);
  };

  const updateItemPrice = (idx: number, field: 'quantity' | 'unitPrice' | 'price' | 'toggleSign', value: number) => {
    if (!showConfirmModal) return;
    const next = { ...showConfirmModal };
    const item = { ...next.items[idx] };
    
    if (field === 'toggleSign') {
      item.unitPrice = item.unitPrice * -1;
      item.price = item.quantity * item.unitPrice;
    } else if (field === 'quantity') { 
      item.quantity = value; 
      item.price = item.quantity * item.unitPrice; 
    } else if (field === 'unitPrice') { 
      item.unitPrice = value; 
      item.price = item.quantity * item.unitPrice; 
    } else if (field === 'price') { 
      item.price = value; 
    }
    
    const ps = Object.keys(item.shares);
    if (ps.length > 0) {
      const sh = Math.floor(item.price / ps.length);
      const rem = item.price % ps.length;
      ps.forEach((p, i) => item.shares[p] = sh + (i === 0 ? rem : 0));
    }
    next.items[idx] = item;
    setShowConfirmModal(next);
  };

  const currentCurrencySymbol = showConfirmModal?.currency === 'JPY' ? '¥' : '$';
  const totalAllocatedSum = showConfirmModal ? showConfirmModal.items.reduce((acc, it) => acc + it.price, 0) : 0;
  const difference = showConfirmModal ? (showConfirmModal.totalAmount - totalAllocatedSum) : 0;

  return (
    <div className="p-6 space-y-10 animate-fade-in pb-48 max-w-2xl mx-auto text-left">
      <input type="file" ref={avatarInputRef} className="hidden" onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file || !avatarUploadTarget) return;
        const base64 = await blobToBase64(file);
        onUpdateMembers(members.map(m => m.id === avatarUploadTarget ? { ...m, customAvatar: base64 } : m));
        setAvatarUploadTarget(null);
      }} accept="image/*" />
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleScan} accept="image/*" />

      {/* 債務結算大字報 (對沖邏輯) */}
      <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px]"></div>
        <div className="relative z-10">
           <div className="text-3xl font-black tracking-tighter tabular-nums leading-tight space-y-4 text-center">
              {Math.abs(netJPY) > 0.5 && (
                <div className="text-emerald-400">
                  {netJPY > 0 ? `Sandy → 英茵 ¥${Math.round(netJPY).toLocaleString()}` : `英茵 → Sandy ¥${Math.round(Math.abs(netJPY)).toLocaleString()}`}
                </div>
              )}
              {Math.abs(netTWD) > 0.5 && (
                <div className="text-amber-400">
                  {netTWD > 0 ? `Sandy → 英茵 $${Math.round(netTWD).toLocaleString()}` : `英茵 → Sandy $${Math.round(Math.abs(netTWD)).toLocaleString()}`}
                </div>
              )}
              {Math.abs(netJPY) <= 0.5 && Math.abs(netTWD) <= 0.5 && <div className="text-indigo-200">帳務完全平衡</div>}
           </div>
        </div>
      </div>

      {/* 分攤成員區塊 (家庭分列) */}
      <div className="space-y-6">
        <div className="flex justify-between items-center px-1">
           <h3 className="text-lg font-black text-slate-700 uppercase tracking-widest">分擔成員</h3>
           <button onClick={() => setIsManagingMembers(true)} className="p-3 text-indigo-500 bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm active:scale-90 transition-all"><Settings size={24}/></button>
        </div>
        
        <div className="space-y-8">
          {FAMILY_HEADS.map(family => {
            const familyTotalTWD = members
              .filter(m => m.family === family)
              .reduce((acc, m) => acc + (stats.individualTWD[m.name] || 0), 0);

            return (
              <div key={family} className="space-y-4">
                <div className="flex justify-between items-end px-2 ml-1 border-l-4 border-indigo-100">
                  <div className="text-base font-bold text-slate-500 uppercase tracking-widest">{family} 家</div>
                  <div className="text-[10px] font-black bg-slate-100 text-slate-400 px-3 py-1 rounded-full tabular-nums">
                    家庭總支出 ${Math.round(familyTotalTWD).toLocaleString()}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {members.filter(m => m.family === family).map(m => (
                    <button key={m.id} onClick={() => setViewingMemberDetails(m)} className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center active:scale-95 transition-all">
                        <img src={m.customAvatar || m.avatar} className="w-12 h-12 rounded-full border-2 border-slate-50 shadow-md object-cover mb-2.5" />
                        <div className="text-sm font-bold text-slate-600 truncate w-full text-center tracking-tight">{m.name}</div>
                        <div className="text-base font-black text-emerald-600 mt-1.5 tabular-nums leading-none">
                          ${Math.round(stats.individualTWD[m.name]).toLocaleString()}
                        </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="flex gap-3 px-1 pt-2">
           <button onClick={handleExport} className="flex-1 text-sm font-black text-slate-600 bg-white px-4 py-4 rounded-xl border border-slate-100 flex items-center justify-center gap-2 shadow-sm">
             <FileText size={16}/> 匯出報表
           </button>
           <button onClick={() => { setRateInput(String(exchangeRate)); setIsEditingRate(true); }} className="flex-1 text-sm font-black text-emerald-600 bg-emerald-50 px-4 py-4 rounded-xl border border-emerald-100 flex items-center justify-center gap-2 shadow-sm">
             <TrendingUp size={16}/> 匯率 {exchangeRate}
           </button>
        </div>
      </div>

      {isEditingRate && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setIsEditingRate(false)}>
           <div className="bg-white p-8 rounded-[32px] shadow-2xl w-full max-sm:w-full max-w-sm space-y-6" onClick={e => e.stopPropagation()}>
              <div className="text-xl font-black text-slate-800">修改基準匯率</div>
              <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">1 JPY = ? TWD</label>
                 <input autoFocus type="number" step="0.001" inputMode="decimal" value={rateInput} onChange={e => setRateInput(e.target.value)} className="w-full bg-slate-50 p-5 rounded-2xl font-black text-3xl border border-slate-100 outline-none focus:border-indigo-200 transition-colors" />
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setIsEditingRate(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black rounded-xl">取消</button>
                 <button onClick={() => { const val = parseFloat(rateInput); if (!isNaN(val)) onUpdateRate(val); setIsEditingRate(false); }} className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-xl shadow-lg active:scale-95 transition-all">儲存</button>
              </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
         <button onClick={() => fileInputRef.current?.click()} className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col items-center gap-2 active:scale-95 transition-all">
            {loading ? <RefreshCw className="animate-spin" size={28}/> : <Camera size={28} />}
            <span className="text-sm font-black tracking-widest uppercase">AI 掃描收據</span>
         </button>
         <button onClick={handleManualEntry} className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 flex flex-col items-center gap-2 active:scale-95 transition-all">
            <Plus className="text-indigo-600" size={28} />
            <span className="text-sm font-black tracking-widest uppercase text-slate-700">手動建立紀錄</span>
         </button>
      </div>

      <div className="space-y-4">
         <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">最近旅行消費</h3>
         <div className="space-y-3">
            {expenses.map(exp => (
              <div key={exp.id} className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden animate-scale-in">
                 <button onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)} className="w-full p-5 flex items-center text-left">
                    <div className={`p-4 rounded-2xl shrink-0 ${CATEGORY_MAP[exp.category || 'other'].bg} ${CATEGORY_MAP[exp.category || 'other'].color}`}>
                        {React.createElement(CATEGORY_MAP[exp.category || 'other'].icon, {size: 24})}
                    </div>
                    <div className="ml-4 flex-1 min-w-0 pr-2">
                       <div className="text-lg font-black text-slate-800 truncate leading-tight">{exp.storeName}</div>
                       <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider truncate">
                         {exp.date} · {exp.paidBy} 支付
                       </div>
                    </div>
                    <div className="text-right shrink-0">
                       <div className="text-xl font-black text-slate-900 tabular-nums">
                         {exp.currency === 'JPY' ? '¥' : '$'}{exp.totalAmount.toLocaleString()}
                       </div>
                       <ChevronRight size={16} className={`text-slate-200 ml-auto mt-1 transition-transform ${expandedId === exp.id ? 'rotate-90' : ''}`} />
                    </div>
                 </button>
                 {expandedId === exp.id && (
                   <div className="px-5 pb-5 space-y-4 bg-slate-50/50 border-t border-slate-50">
                      <div className="pt-4 space-y-2">
                         {exp.items.map(item => (
                           <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                              <div className="flex-1 min-w-0 pr-4">
                                 <div className="text-sm font-black text-slate-700 truncate">{item.translatedName}</div>
                                 <div className="text-[10px] font-bold text-slate-400 mt-0.5 flex flex-wrap gap-1">
                                    {Object.keys(item.shares).map(p => <span key={p} className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{p}</span>)}
                                 </div>
                              </div>
                              <div className="text-right shrink-0">
                                 <div className={`text-base font-black tabular-nums ${item.price < 0 ? 'text-rose-500' : 'text-indigo-600'}`}>
                                   {exp.currency === 'JPY' ? '¥' : '$'} {item.price.toLocaleString()}
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowConfirmModal(exp)} className="flex-1 py-3 bg-indigo-50 text-indigo-600 font-black text-xs rounded-xl border border-indigo-100 transition-all">編輯</button>
                        <button onClick={() => onUpdate(expenses.filter(e => e.id !== exp.id))} className="flex-1 py-3 bg-rose-50 text-rose-500 font-black text-xs rounded-xl transition-all">刪除</button>
                      </div>
                   </div>
                 )}
              </div>
            ))}
         </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-[600] bg-slate-900/90 backdrop-blur-md flex items-end justify-center p-0 animate-fade-in" onClick={() => setShowConfirmModal(null)}>
           <div className="bg-white w-full max-w-xl rounded-t-[40px] overflow-hidden flex flex-col shadow-2xl max-h-[96vh]" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <div className="flex-1 min-w-0 pr-4">
                    <span className="text-xs font-black text-indigo-500 uppercase tracking-widest block mb-1">編輯消費紀錄</span>
                    <input className="text-2xl font-black w-full bg-transparent border-none outline-none p-0 focus:text-indigo-600 truncate" value={showConfirmModal.storeName} onChange={e => setShowConfirmModal({...showConfirmModal, storeName: e.target.value})} placeholder="商店名稱" />
                 </div>
                 <button onClick={() => setShowConfirmModal(null)} className="p-3 bg-white rounded-xl text-slate-300 shadow-sm border border-slate-100 shrink-0"><X size={24}/></button>
              </div>

              <div className="p-6 space-y-8 overflow-y-auto scrollbar-hide pb-20">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">付款人</label>
                       <select 
                         className="w-full bg-slate-50 p-4 rounded-xl font-black text-lg border border-slate-100 outline-none shadow-sm" 
                         value={showConfirmModal.paidBy} 
                         onChange={e => {
                            const newPayer = e.target.value;
                            const updatedItems = showConfirmModal.items.map(item => ({
                              ...item,
                              shares: { [newPayer]: item.price }
                            }));
                            setShowConfirmModal({ ...showConfirmModal, paidBy: newPayer, items: updatedItems });
                         }}
                       >
                          {FAMILY_HEADS.map(name => <option key={name} value={name}>{name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">幣別</label>
                       <div className="flex bg-slate-100 p-1 rounded-xl h-[60px]">
                          <button onClick={() => setShowConfirmModal({...showConfirmModal, currency: 'JPY'})} className={`flex-1 rounded-lg font-black text-base transition-all ${showConfirmModal.currency === 'JPY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>JPY (¥)</button>
                          <button onClick={() => setShowConfirmModal({...showConfirmModal, currency: 'TWD'})} className={`flex-1 rounded-lg font-black text-base transition-all ${showConfirmModal.currency === 'TWD' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>TWD ($)</button>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    {showConfirmModal.items.map((item, idx) => {
                       const currentSum = (Object.values(item.shares) as number[]).reduce((a, b) => a + b, 0);
                       const diffItem = item.price - currentSum;
                       const isValidItem = Math.abs(diffItem) < 0.1;
                       const isNegative = item.unitPrice < 0;

                       return (
                        <div key={item.id} className="bg-slate-50/80 p-5 rounded-3xl border border-slate-100 space-y-6 w-full">
                           <div className="flex items-start gap-3">
                              <div className="flex-1 space-y-4 w-full">
                                 <input className="text-xl font-black text-slate-800 bg-white px-5 py-4 rounded-2xl w-full border border-slate-200 outline-none focus:border-indigo-400 shadow-sm" value={item.translatedName} placeholder="中文品名" onChange={e => {
                                    const next = [...showConfirmModal.items]; next[idx].translatedName = e.target.value; setShowConfirmModal({...showConfirmModal, items: next});
                                 }} />
                                 <div className="flex flex-wrap gap-4 w-full">
                                    <div className="w-24 shrink-0 space-y-2">
                                       <label className="text-xs font-black text-slate-400 uppercase text-center block">數量</label>
                                       <input type="number" inputMode="numeric" className="w-full h-14 bg-white border border-slate-200 rounded-xl text-center text-xl font-black outline-none focus:border-indigo-400 tabular-nums shadow-sm" value={item.quantity} onChange={e => updateItemPrice(idx, 'quantity', parsePrice(e.target.value))} />
                                    </div>
                                    <div className="flex-1 min-w-[150px] space-y-2">
                                       <div className="flex justify-between items-center px-1">
                                         <label className="text-xs font-black text-slate-400 uppercase">單價</label>
                                         {isNegative && <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded uppercase">折扣/支出</span>}
                                       </div>
                                       <div className="flex gap-3">
                                         <input type="number" inputMode="numeric" className={`flex-1 h-14 bg-white border border-slate-200 rounded-xl px-4 text-2xl font-black outline-none focus:border-indigo-400 tabular-nums shadow-sm min-w-0 ${isNegative ? 'text-rose-500' : 'text-slate-800'}`} value={Math.abs(item.unitPrice)} onChange={e => updateItemPrice(idx, 'unitPrice', parsePrice(e.target.value) * (isNegative ? -1 : 1))} />
                                         <button onClick={() => updateItemPrice(idx, 'toggleSign', 0)} className={`w-14 h-14 shrink-0 rounded-xl flex items-center justify-center transition-all shadow-sm font-black text-2xl ${isNegative ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>±</button>
                                       </div>
                                    </div>
                                 </div>
                                 <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-400 uppercase px-1">項目小計</label>
                                    <div className={`w-full h-14 bg-white flex items-center px-5 rounded-xl text-2xl font-black tabular-nums border border-slate-200 shadow-inner ${isNegative ? 'text-rose-500' : 'text-indigo-600'}`}>
                                       {currentCurrencySymbol} {item.price.toLocaleString()}
                                    </div>
                                 </div>
                              </div>
                              <button onClick={() => {
                                 const next = showConfirmModal.items.filter((_, i) => i !== idx);
                                 setShowConfirmModal({...showConfirmModal, items: next});
                              }} className="p-2 text-rose-300 transition-colors mt-3 shrink-0"><Trash2 size={24}/></button>
                           </div>

                           <div className="space-y-5 pt-5 border-t border-slate-200/50">
                              <div className="flex justify-between items-center px-1">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">分擔細節</span>
                                 <span className={`text-[11px] font-black px-3 py-1 rounded-full ${isValidItem ? 'text-emerald-500 bg-emerald-50' : 'text-rose-500 bg-rose-50'}`}>
                                    {isValidItem ? "✓ OK" : `✗ 差 ${Math.abs(diffItem).toLocaleString()}`}
                                 </span>
                              </div>
                              <div className="space-y-6">
                                 {FAMILY_HEADS.map(family => (
                                   <div key={family} className="space-y-3">
                                     <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{family} 家</div>
                                     <div className="flex flex-wrap gap-2 px-0.5">
                                       {members.filter(m => m.family === family).map(m => {
                                          const isSelected = item.shares[m.name] !== undefined;
                                          return (
                                            <button key={m.id} onClick={() => handleToggleMemberShare(idx, m.name)} className={`px-5 py-3 rounded-2xl text-sm font-black transition-all border ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>
                                               {m.name}
                                            </button>
                                          );
                                       })}
                                     </div>
                                     <div className="space-y-3">
                                       {members.filter(m => m.family === family && item.shares[m.name] !== undefined).map(m => (
                                         <div key={m.id} className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                                            <span className="text-base font-black text-slate-700 truncate">{m.name}</span>
                                            <div className="flex items-center gap-2 shrink-0">
                                               <span className="text-xs font-bold text-slate-300">{currentCurrencySymbol}</span>
                                               <input type="number" inputMode="numeric" className={`w-24 text-right text-xl font-black bg-slate-50 px-3 py-1.5 rounded-xl outline-none tabular-nums ${item.shares[m.name] < 0 ? 'text-rose-500' : 'text-indigo-600'}`} value={item.shares[m.name]} onChange={e => {
                                                  const next = {...showConfirmModal};
                                                  next.items[idx].shares[m.name] = parsePrice(e.target.value);
                                                  setShowConfirmModal(next);
                                               }} />
                                            </div>
                                         </div>
                                       ))}
                                     </div>
                                   </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                       );
                    })}
                    <button onClick={() => {
                       const next = [...showConfirmModal.items];
                       next.push({ id: `item-${Date.now()}`, name: '原文品名', translatedName: '新項目', quantity: 1, unitPrice: 0, price: 0, shares: { [showConfirmModal.paidBy]: 0 } });
                       setShowConfirmModal({...showConfirmModal, items: next});
                    }} className="w-full py-5 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-black flex items-center justify-center gap-3 hover:bg-slate-50 transition-all text-sm uppercase tracking-widest">
                       <Plus size={22}/> 增加細項
                    </button>
                 </div>

                 <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-xl relative overflow-hidden flex flex-col gap-5">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
                    
                    <div className="relative z-10 flex justify-between items-end border-b border-white/10 pb-4">
                       <div className="space-y-1 w-full">
                          <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest">發票總額</label>
                          <div className="flex items-center gap-3">
                             <span className="text-2xl font-black text-indigo-200">{currentCurrencySymbol}</span>
                             <input type="number" inputMode="numeric" className="bg-white/10 border-none outline-none text-3xl font-black tabular-nums w-full focus:bg-white/20 rounded px-2" value={showConfirmModal.totalAmount} onChange={(e) => setShowConfirmModal({...showConfirmModal, totalAmount: parsePrice(e.target.value)})} />
                          </div>
                       </div>
                    </div>

                    <div className="relative z-10 grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">品項小計</label>
                          <div className="text-xl font-black tabular-nums">{currentCurrencySymbol} {totalAllocatedSum.toLocaleString()}</div>
                       </div>
                       <div className="space-y-1 text-right">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">差額</label>
                          <div className={`text-xl font-black tabular-nums ${Math.abs(difference) < 0.1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                             {currentCurrencySymbol} {difference.toLocaleString()}
                          </div>
                       </div>
                    </div>

                    <div className={`relative z-10 flex items-center gap-3 p-3 rounded-2xl ${Math.abs(difference) < 0.1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {Math.abs(difference) < 0.1 ? <CheckCircle2 size={24}/> : <AlertCircle size={24}/>}
                        <span className="text-sm font-bold">{Math.abs(difference) < 0.1 ? "金額完全吻合" : "發票總額與品項不符"}</span>
                    </div>
                 </div>

                 <div className="pt-2 flex flex-col gap-4">
                    <button onClick={() => { 
                        const isAllValid = showConfirmModal.items.every(it => Math.abs(it.price - (Object.values(it.shares) as number[]).reduce((a, b) => a + b, 0)) < 0.1);
                        if (!isAllValid) return alert(`品項分配未完成！請檢查紅字細項。`);
                        if (Math.abs(difference) >= 0.1) {
                           if (!confirm(`發票總額 (${showConfirmModal.totalAmount}) 與品項合計 (${totalAllocatedSum}) 不符，確定要儲存嗎？`)) return;
                        }
                        const isExisting = expenses.some(e => e.id === showConfirmModal.id);
                        if (isExisting) onUpdate(expenses.map(e => e.id === showConfirmModal.id ? showConfirmModal : e));
                        else onUpdate([showConfirmModal, ...expenses]);
                        setShowConfirmModal(null); 
                      }} className="w-full py-6 bg-indigo-600 text-white rounded-[24px] text-xl font-black shadow-lg active:scale-95 transition-all uppercase tracking-widest">確認儲存並同步</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 成員管理 Modal */}
      {isManagingMembers && (
        <div className="fixed inset-0 z-[1000] bg-white flex flex-col animate-fade-in overflow-y-auto">
           <div className="p-4 flex justify-between items-center border-b border-gray-100">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3"><Users className="text-indigo-500" size={24}/> 成員管理</h2>
              <button onClick={() => setIsManagingMembers(false)} className="p-2 bg-slate-50 rounded-xl text-slate-400"><X size={24}/></button>
           </div>
           
           <div className="p-4 flex-1 space-y-6 max-w-2xl mx-auto w-full">
              <div className="bg-slate-50 p-4 rounded-3xl space-y-4">
                 <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="成員名稱" className="w-full bg-white px-5 py-4 rounded-xl font-black text-base outline-none shadow-sm border border-slate-100" />
                 <select value={newMemberFamily} onChange={e => setNewMemberFamily(e.target.value as any)} className="w-full bg-white px-5 py-4 rounded-xl font-black text-base outline-none shadow-sm border border-slate-100">
                    <option value="Sandy">Sandy 家</option><option value="英茵">英茵 家</option>
                 </select>
                 <button onClick={() => {
                    if (!newMemberName.trim()) return;
                    onUpdateMembers([...members, { id: `m-${Date.now()}`, name: newMemberName, family: newMemberFamily, avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${newMemberName}` }]);
                    setNewMemberName('');
                 }} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"><Plus size={24}/> 確認新增成員</button>
              </div>

              <div className="space-y-3">
                 {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                       <div className="flex items-center gap-4 min-w-0">
                          <button onClick={() => { setAvatarUploadTarget(m.id); avatarInputRef.current?.click(); }} className="relative group shrink-0">
                               <img src={m.customAvatar || m.avatar} className="w-12 h-12 rounded-full object-cover border-2 border-slate-50 shadow-sm" />
                               <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 flex items-center justify-center transition-opacity"><Camera size={16} className="text-white"/></div>
                          </button>
                          <div className="min-w-0">
                               <div className="text-lg font-black text-slate-800 truncate leading-none">{m.name}</div>
                               <div className={`text-[10px] font-black px-2 py-0.5 rounded-lg inline-block mt-1.5 ${m.family === 'Sandy' ? 'bg-indigo-50 text-indigo-500' : 'bg-rose-50 text-rose-500'}`}>{m.family} Family</div>
                          </div>
                       </div>
                       <button onClick={() => onUpdateMembers(members.filter(mem => mem.id !== m.id))} className="p-3 bg-rose-50 text-rose-300 rounded-xl active:scale-90"><Trash2 size={24}/></button>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {viewingMemberDetails && (
        <div className="fixed inset-0 z-[700] bg-slate-900/95 backdrop-blur-md flex items-end md:items-center justify-center animate-fade-in" onClick={() => setViewingMemberDetails(null)}>
           <div className="bg-white w-full max-w-md rounded-t-[40px] md:rounded-[32px] overflow-hidden flex flex-col shadow-2xl max-h-[85vh]" onClick={e => e.stopPropagation()}>
              <div className="p-8 border-b border-slate-50 flex items-center gap-8 bg-indigo-50/20">
                 <img src={viewingMemberDetails.customAvatar || viewingMemberDetails.avatar} className="w-24 h-24 rounded-full border-4 border-white shadow-xl object-cover shrink-0" />
                 <div className="min-w-0">
                    <h2 className="text-3xl font-black text-slate-900 leading-tight truncate">{viewingMemberDetails.name}</h2>
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">{viewingMemberDetails.family} Family</p>
                    <div className="text-2xl font-black text-emerald-600 mt-2 tabular-nums">$ {Math.round(stats.individualTWD[viewingMemberDetails.name]).toLocaleString()}</div>
                 </div>
              </div>
              <div className="p-8 overflow-y-auto space-y-4 scrollbar-hide">
                 {stats.individualDetails[viewingMemberDetails.name]?.map((det, i) => (
                    <div key={i} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex justify-between items-center">
                       <div className="space-y-1 min-w-0 pr-4 flex-1">
                          <div className="text-lg font-black text-slate-700 truncate">{det.item}</div>
                          <div className="text-xs font-bold text-slate-400 italic truncate">{det.store}</div>
                          <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider tabular-nums">{det.date}</div>
                       </div>
                       <div className="text-right shrink-0">
                          <div className={`text-xl font-black tabular-nums ${det.amount < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>{det.currency === 'JPY' ? '¥' : '$'} {det.amount.toLocaleString()}</div>
                       </div>
                    </div>
                 ))}
              </div>
              <div className="p-8 pt-0">
                 <button onClick={() => setViewingMemberDetails(null)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl shadow-lg">返回</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

// ############################################################
// #### AIHelperTab Component (智慧助手規範版本) ####
// ############################################################
const AIHelperTab = ({ aiItems, onUpdateItems, exchangeRate }: { 
  aiItems: AIScanItem[], onUpdateItems: (it: AIScanItem[]) => void, exchangeRate: number 
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [helperMode, setHelperMode] = useState<'order' | 'shop' | 'guide'>('order');
  const [tempItems, setTempItems] = useState<AIScanItem[]>([]);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [expandedRecords, setExpandedRecords] = useState(new Set<string>());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modeConfig = {
    order: { label: 'AI點餐', color: 'bg-indigo-600', text: 'text-indigo-600', icon: Utensils, desc: '快速翻譯菜單與價格換算，支援份量討論' },
    shop: { label: 'AI購物', color: 'bg-pink-600', text: 'text-pink-600', icon: ShoppingBag, desc: '台日即時比價，提供深度介紹與亮點摘要' },
    guide: { label: 'AI導遊', color: 'bg-emerald-600', text: 'text-emerald-600', icon: MapPin, desc: '景點智慧辨識，產生深度人文歷史導覽' },
  };

  const toggleRecord = (rid: string) => {
    setExpandedRecords(prev => {
      const next = new Set(prev);
      if (next.has(rid)) next.delete(rid); else next.add(rid);
      return next;
    });
  };

  const handleAIIdentify = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading("處理中..."); setTempItems([]); setEditingRecordId(null);
    try {
      const base64Str = await blobToBase64(file);
      const compressedData = base64Str.split(',')[1];
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let prompt = "";
      let schema: any;

      if (helperMode === 'order') {
        prompt = "辨識菜單。nameSub是日文原文，name是中文翻譯。price是日幣單價。請以 JSON 回傳。";
        schema = {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, nameSub: { type: Type.STRING }, price: { type: Type.NUMBER } } }
            }
          }
        };
      } else if (helperMode === 'shop') {
        prompt = `辨識購物產品照片。請提取：
        1. name (中文名稱) 2. nameSub (日文原文) 3. price (日本當地日幣售價) 
        4. priceTW_Ref (台灣同款產品的參考平均售價，單位：台幣) 
        5. description (約 100 字的生動中文產品介紹，包含用途或成分) 
        6. features (以標籤形式列出 3-5 個商品特色，例如：#北海道限定、#美白首選)。
        請以 JSON 回傳。嚴禁英文。`;
        schema = {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: { 
                type: Type.OBJECT, 
                properties: { 
                  name: { type: Type.STRING }, 
                  nameSub: { type: Type.STRING }, 
                  price: { type: Type.NUMBER }, 
                  priceTW_Ref: { type: Type.NUMBER }, 
                  description: { type: Type.STRING }, 
                  features: { type: Type.STRING } 
                } 
              }
            }
          }
        };
      } else {
        prompt = `辨識景點照片。請提取：
        1. name (中文名稱) 
        2. description (約 150 字的深度中文導覽，包含人文歷史、建築特色或背景故事) 
        3. price (門票日幣價格，若為免費景點則回傳 0)。
        請以 JSON 回傳。嚴禁英文。`;
        schema = {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: { 
                type: Type.OBJECT, 
                properties: { 
                  name: { type: Type.STRING }, 
                  description: { type: Type.STRING },
                  price: { type: Type.NUMBER }
                } 
              }
            }
          }
        };
      }
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ inlineData: { data: compressedData, mimeType: 'image/jpeg' } }, { text: prompt }] }],
        config: { responseMimeType: "application/json", responseSchema: schema }
      });

      const parsed = JSON.parse(response.text.trim());
      const mapped: AIScanItem[] = (parsed.items || []).map((item: any, idx: number) => ({
        id: `scan-${Date.now()}-${idx}`,
        type: helperMode,
        name: item.name || '辨識結果',
        nameSub: item.nameSub || '',
        price: parsePrice(item.price),
        priceTW_Ref: parsePrice(item.priceTW_Ref),
        quantity: helperMode === 'order' ? 0 : 1,
        description: item.description || '',
        features: item.features || '',
      }));
      setTempItems(mapped);
    } catch (err: any) { alert(`辨識失敗，請檢查網路。`); } 
    finally { setLoading(null); if(fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const currentTempTotalJPY = useMemo(() => 
    tempItems.reduce((acc, i) => acc + (i.price * i.quantity), 0)
  , [tempItems]);

  const saveToHistory = () => {
    const rid = editingRecordId || `rec-${Date.now()}`;
    const filtered = helperMode === 'order' ? tempItems.filter(i => i.quantity > 0) : tempItems;
    if (filtered.length === 0 && helperMode === 'order') return alert('請先選取品項');
    
    const toSave = filtered.map(i => ({...i, recordId: rid, timestamp: Date.now()}));
    const baseItems = editingRecordId ? aiItems.filter(i => i.recordId !== editingRecordId) : aiItems;
    
    onUpdateItems([...toSave, ...baseItems]);
    setTempItems([]);
    setEditingRecordId(null);
  };

  const groupedHistory = useMemo(() => {
    const items = aiItems.filter(i => i.type === helperMode);
    const groups: Record<string, AIScanItem[]> = {};
    items.forEach(item => {
      const rid = item.recordId || 'legacy';
      if (!groups[rid]) groups[rid] = [];
      groups[rid].push(item);
    });
    return Object.entries(groups).sort((a, b) => {
      const timeA = a[1][0]?.timestamp || 0;
      const timeB = b[1][0]?.timestamp || 0;
      return timeB - timeA;
    });
  }, [aiItems, helperMode]);

  return (
    <div className="p-6 space-y-6 pb-48 max-w-2xl mx-auto text-left animate-fade-in">
      <div className="flex bg-white p-1.5 rounded-[24px] shadow-sm border border-gray-100">
        {Object.entries(modeConfig).map(([mode, cfg]) => (
          <button key={mode} onClick={() => { setHelperMode(mode as any); setTempItems([]); setEditingRecordId(null); }} className={`flex-1 flex flex-col items-center py-4 rounded-[18px] transition-all ${helperMode === mode ? cfg.color + ' text-white shadow-lg' : 'text-gray-400'}`}>
            <cfg.icon size={22} className="mb-1" /><span className="text-[17px] font-black">{cfg.label}</span>
          </button>
        ))}
      </div>

      <div className={`p-8 rounded-[48px] text-white shadow-2xl relative overflow-hidden flex flex-col items-center text-center gap-6 transition-all duration-500 ${modeConfig[helperMode].color}`}>
        <div className="relative z-10">
          <Sparkles className="mb-4 text-white/30 mx-auto" size={32} />
          <h2 className="text-[26px] font-black mb-1">{modeConfig[helperMode].label}助理</h2>
          <p className="text-white/70 text-[16px] font-medium leading-relaxed max-w-md">{modeConfig[helperMode].desc}</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()} className="relative z-10 bg-white text-gray-900 px-10 py-5 rounded-[24px] text-[18px] font-black shadow-xl flex items-center gap-3 active:scale-95 transition-all">
          <Camera size={24} /> {loading || "拍照辨識"}
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAIIdentify} />
      </div>

      {tempItems.length > 0 && (
        <div className="bg-white p-6 rounded-[40px] border border-gray-100 shadow-xl space-y-6 animate-scale-in">
          <div className="flex justify-between items-center px-4 border-b border-slate-50 pb-4">
             <div className="text-[13px] font-black text-indigo-400 uppercase tracking-widest">{editingRecordId ? '編輯模式' : '辨識結果'}</div>
             {helperMode !== 'guide' && (
                <div className="text-right">
                    <div className="text-[24px] font-black text-slate-900">¥ {currentTempTotalJPY.toLocaleString()}</div>
                    <div className="text-[12px] font-bold text-slate-400">約 NT$ {Math.round(currentTempTotalJPY * exchangeRate).toLocaleString()}</div>
                </div>
             )}
          </div>
          <div className="space-y-4 max-h-[50vh] overflow-y-auto scrollbar-hide px-2">
            {tempItems.map((item, idx) => {
               const jpInTw = Math.round(item.price * exchangeRate);
               const savings = (item.priceTW_Ref || 0) - jpInTw;
               return (
                 <div key={item.id} className={`bg-slate-50 px-5 py-5 rounded-[32px] border border-gray-100 ${item.quantity > 0 ? 'border-indigo-100 bg-indigo-50/10' : ''}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="text-[22px] font-black text-slate-800 leading-tight">{item.name}</div>
                        {item.nameSub && <div className="text-[13px] font-bold text-slate-400 italic mt-0.5 truncate">{item.nameSub}</div>}
                      </div>
                      {(item.price > 0 || helperMode !== 'guide') && (
                        <div className="text-right shrink-0">
                            <div className={`text-[17px] font-black ${modeConfig[helperMode].text}`}>¥{item.price.toLocaleString()}</div>
                            <div className="text-[11px] font-bold text-slate-300">約 NT${jpInTw.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                    
                    {helperMode === 'shop' && (
                       <div className="space-y-4 pt-3 border-t border-slate-200/50">
                          <div className="flex justify-between items-center">
                             <div className="text-[12px] font-black text-slate-400">台灣參考價 <span className="text-slate-900">$NT{item.priceTW_Ref || ' -'}</span></div>
                             {savings > 0 && (
                                <div className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse">
                                   省下 NT$ {savings.toLocaleString()}
                                </div>
                             )}
                          </div>
                          {item.features && <div className="text-[11px] font-black text-indigo-500 flex flex-wrap gap-1.5">{item.features}</div>}
                          {item.description && <p className="text-[13px] text-slate-500 leading-relaxed font-medium line-clamp-2">{item.description}</p>}
                       </div>
                    )}

                    {helperMode === 'guide' && (
                       <div className="pt-3 border-t border-slate-200/50 space-y-4">
                          {item.price > 0 && (
                             <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl w-fit">
                                <Ticket size={14}/>
                                <span className="text-[12px] font-black">門票費用 ¥{item.price.toLocaleString()}</span>
                             </div>
                          )}
                          <p className="text-[15px] text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{item.description}</p>
                       </div>
                    )}

                    {helperMode === 'order' && (
                      <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-200/50">
                        <div className="flex items-center bg-white rounded-full p-1 border border-slate-100">
                          <button onClick={() => { const n = [...tempItems]; n[idx].quantity = Math.max(0, n[idx].quantity - 1); setTempItems(n); }} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-300"><Minus size={14}/></button>
                          <span className="text-[15px] font-black w-7 text-center">{item.quantity}</span>
                          <button onClick={() => { const n = [...tempItems]; n[idx].quantity += 1; setTempItems(n); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 text-white"><Plus size={14}/></button>
                        </div>
                      </div>
                    )}
                 </div>
               );
            })}
          </div>
          <div className="flex gap-4">
             <button onClick={() => { setTempItems([]); setEditingRecordId(null); }} className="flex-1 py-5 bg-slate-50 text-slate-400 font-black rounded-[24px]">取消</button>
             <button onClick={saveToHistory} className={`flex-[2] py-5 ${modeConfig[helperMode].color} text-white font-black rounded-[24px] shadow-lg`}>
               {editingRecordId ? '更新紀錄' : (helperMode === 'guide' ? '儲存景點' : '確認儲存')}
             </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-[16px] font-black text-slate-400 uppercase tracking-widest px-4 flex items-center gap-2"><Clock size={20}/> 智慧助手歷史</h3>
        {groupedHistory.map(([rid, items]) => {
           const isExpanded = expandedRecords.has(rid);
           const first = items[0];
           const totalJpy = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
           
           return (
             <div key={rid} className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden animate-scale-in">
                <button onClick={() => toggleRecord(rid)} className="w-full p-7 flex justify-between items-center text-left hover:bg-slate-50 transition-colors">
                  <div className="flex-1 truncate pr-6">
                    <div className="text-[10px] font-black text-slate-300 mb-1.5">{new Date(first.timestamp || 0).toLocaleString()}</div>
                    <div className={`text-[22px] font-black leading-tight truncate ${modeConfig[helperMode].text}`}>
                      {helperMode === 'shop' || helperMode === 'guide' ? first.name : (helperMode === 'order' ? items.map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(', ') : first.name)}
                    </div>
                    <div className="text-[13px] font-bold text-slate-400 mt-1 flex items-center gap-2">
                       {helperMode === 'order' ? `共 ${items.length} 份點餐` : (helperMode === 'shop' ? '商品比價分析' : '深度導覽摘要')}
                       {totalJpy > 0 && (
                          <>
                            <span className="text-slate-200">|</span>
                            <span className="font-black text-slate-900">¥{totalJpy.toLocaleString()}</span>
                          </>
                       )}
                    </div>
                  </div>
                  <ChevronDown className={`text-slate-200 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="px-6 pb-6 space-y-4 bg-slate-50/40 border-t border-slate-50 pt-4 animate-fade-in">
                    <div className="flex gap-2">
                       <button onClick={() => {
                          setHelperMode(items[0].type);
                          setTempItems(items.map(i => ({...i})));
                          setEditingRecordId(rid);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                       }} className="flex-1 py-3 bg-white text-indigo-600 rounded-2xl font-black text-[12px] border border-indigo-50 shadow-sm flex items-center justify-center gap-2"><Edit3 size={14}/> 編輯此紀錄</button>
                       <button onClick={() => onUpdateItems(aiItems.filter(i => i.recordId !== rid))} className="flex-1 py-3 bg-rose-50 text-rose-400 rounded-2xl font-black text-[12px] flex items-center justify-center gap-2"><Trash2 size={14}/> 刪除</button>
                    </div>
                    {items.map(item => {
                       const jpInTw = Math.round(item.price * exchangeRate);
                       const savings = (item.priceTW_Ref || 0) - jpInTw;
                       return (
                        <div key={item.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 text-left">
                          <div className="flex justify-between items-start">
                             <div className="flex-1 truncate pr-4">
                                <div className="text-[20px] font-black text-slate-800 truncate">
                                  {item.name} {helperMode === 'order' && <span className="text-indigo-500 ml-2">x{item.quantity}</span>}
                                </div>
                                {item.nameSub && <div className="text-[12px] font-bold text-slate-400 italic truncate">{item.nameSub}</div>}
                             </div>
                             {(item.price > 0 || helperMode !== 'guide') && (
                                <div className="text-right shrink-0">
                                    <div className={`text-[16px] font-black ${modeConfig[helperMode].text}`}>¥{(item.price * item.quantity).toLocaleString()}</div>
                                    <div className="text-[10px] font-bold text-slate-300">約 NT${(jpInTw * item.quantity).toLocaleString()}</div>
                                </div>
                             )}
                          </div>
                          
                          {helperMode === 'shop' && (
                             <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                <div className="flex justify-between items-center text-[11px] font-black">
                                   <span className="text-slate-400">台幣參考價 $NT {item.priceTW_Ref}</span>
                                   {savings > 0 && <span className="text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">省下 $NT {savings.toLocaleString()}</span>}
                                </div>
                                {item.features && <div className="text-[10px] font-bold text-indigo-400 flex flex-wrap gap-1">{item.features}</div>}
                                {item.description && <p className="text-[13px] text-slate-500 leading-relaxed font-medium">{item.description}</p>}
                             </div>
                          )}

                          {helperMode === 'guide' && (
                             <div className="mt-4 space-y-4">
                                {item.price > 0 && (
                                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl w-fit">
                                        <Ticket size={14}/>
                                        <span className="text-[12px] font-black">門票費用 ¥{item.price.toLocaleString()}</span>
                                    </div>
                                )}
                                <p className="text-[14px] text-slate-500 leading-relaxed font-medium whitespace-pre-wrap">{item.description}</p>
                             </div>
                          )}
                        </div>
                       );
                    })}
                  </div>
                )}
             </div>
           );
        })}
      </div>
    </div>
  );
};

// ############################################################
// #### App Container ####
// ############################################################
const App = () => {
  const [state, setState] = useState<AppState>(() => { 
    const saved = localStorage.getItem('hokkaido_trip_2026_v12'); 
    return saved ? JSON.parse(saved) : INITIAL_DATA; 
  });
  const [activeTab, setActiveTab] = useState<'plan' | 'split' | 'ai'>('plan');
  const [selectedDayNum, setSelectedDayNum] = useState(1);
  const [dbAvailable, setDbAvailable] = useState(true);
  const [editingSpot, setEditingSpot] = useState<Spot | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  useEffect(() => { 
    // Named exports like doc and onSnapshot are reliable when using @firebase scope
    const unsub = onSnapshot(doc(db, "trips", TRIP_DOC_ID), (docSnap) => { 
      if (docSnap.exists()) { 
        setState(docSnap.data() as AppState); setDbAvailable(true); 
      } else { 
        setDoc(doc(db, "trips", TRIP_DOC_ID), INITIAL_DATA); 
      } 
    }, (error) => { setDbAvailable(false); }); 
    return () => unsub(); 
  }, []);

  const pushUpdate = async (updates: Partial<AppState>) => {
    const nextState = { ...state, ...updates }; setState(nextState); localStorage.setItem('hokkaido_trip_2026_v12', JSON.stringify(nextState));
    if (dbAvailable) { try { await setDoc(doc(db, "trips", TRIP_DOC_ID), nextState); } catch (e) { setDbAvailable(false); } }
  };

  const updateSpotInState = (updatedSpot: Spot) => {
    setEditingSpot(updatedSpot);
    pushUpdate({ days: state.days.map(d => ({ ...d, spots: d.spots.map(s => s.id === updatedSpot.id ? updatedSpot : s) })) });
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'img' | 'file') => {
    const uploadedFiles = e.target.files; if (!uploadedFiles || !editingSpot) return;
    const nextSpot = { ...editingSpot };
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const base64 = await blobToBase64(file);
      if (type === 'img') {
        nextSpot.images = [...(nextSpot.images || []), base64];
      } else {
        nextSpot.files = [...(nextSpot.files || []), { name: file.name, data: base64, type: file.type }];
      }
    }
    updateSpotInState(nextSpot);
    e.target.value = '';
  };

  const currentDay = useMemo(() => state.days.find(d => d.dayNum === selectedDayNum) || state.days[0], [state.days, selectedDayNum]);
  const sortedSpots = useMemo(() => [...currentDay.spots].sort((a, b) => a.time.localeCompare(b.time)), [currentDay.spots]);
  const dailyAccommodation = useMemo(() => currentDay.spots.find(s => s.category === 'hotel'), [currentDay]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const width = e.currentTarget.offsetWidth;
    const scrollLeft = e.currentTarget.scrollLeft;
    setCurrentImgIndex(Math.round(scrollLeft / width));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFF] text-gray-900 font-sans pb-40 relative">
      <div className={`text-white text-[10px] font-black py-1 px-4 text-center sticky top-0 z-[1000] flex items-center justify-center gap-2 ${dbAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`}>
        {dbAvailable ? <><Cloud size={10} /> 雲端同步</> : <><CloudOff size={10} /> 離線模式</>}
      </div>

      <div className="relative h-48 bg-gradient-to-br from-[#1E3A8A] via-[#3B82F6] to-[#60A5FA] rounded-b-[60px] shadow-2xl flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute top-6 right-6 z-20">
          <button onClick={() => setIsEditMode(!isEditMode)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-[11px] shadow-lg transition-all bg-white/20 backdrop-blur-md text-white border border-white/30`}>
             {isEditMode ? <ShieldAlert size={14}/> : <ShieldCheck size={14}/>} {isEditMode ? '編輯模式' : '檢視模式'}
          </button>
        </div>
        <div className="relative z-10 text-center space-y-3 mt-4 flex flex-col items-center px-6">
          <h1 className="text-2xl font-black text-white tracking-[0.2em] uppercase drop-shadow-xl">北海道雪之旅 2026</h1>
          <div className="flex items-center justify-center gap-4">
            <div className="flex -space-x-2">
               {state.members.filter(m => CORE_MEMBER_IDS.includes(m.id)).map(m => <img key={m.id} src={m.customAvatar || m.avatar} className="w-7 h-7 rounded-full border border-white shadow-md object-cover" />)}
            </div>
            <div className="bg-white/20 backdrop-blur-md px-5 py-1 rounded-full text-white font-black text-[11px] border border-white/30 tabular-nums">01.11 ~ 01.17</div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {activeTab === 'plan' && (
          <div className="animate-fade-in text-left">
             <div className="flex gap-2 overflow-x-auto py-5 px-6 scrollbar-hide sticky top-0 bg-[#F8FAFF]/95 backdrop-blur-md z-[50]">
               {state.days.map(d => (
                 <button key={d.dayNum} onClick={() => setSelectedDayNum(d.dayNum)} className={`flex-shrink-0 w-12 h-14 rounded-2xl flex flex-col items-center justify-center transition-all border ${selectedDayNum === d.dayNum ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-105' : 'bg-white text-gray-400 border-gray-100 shadow-sm'}`}>
                   <span className="text-[9px] font-black opacity-80 uppercase leading-none mb-1">{['日','一','二','三','四','五','六'][new Date(d.date).getDay()]}</span>
                   <span className="text-lg font-black tabular-nums leading-none">{new Date(d.date).getDate()}</span>
                 </button>
               ))}
             </div>
             
             <div className="px-6 space-y-5 pb-32">
                <div className="flex gap-3 h-28">
                  <div 
                    onClick={() => dailyAccommodation && setEditingSpot(dailyAccommodation)}
                    className="w-3/4 bg-white p-4 rounded-[28px] shadow-sm border border-gray-50 flex flex-col group active:scale-[0.98] transition-all cursor-pointer relative"
                  >
                    <div className="flex flex-col pr-8">
                       <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1"><BedDouble size={10}/> 今日住宿</span>
                       <h3 className="text-[16px] font-black text-slate-800 leading-tight mt-0.5 truncate">{dailyAccommodation?.name || '返家'}</h3>
                       {dailyAccommodation && (dailyAccommodation.hasBreakfast || dailyAccommodation.hasDinner) && (
                         <div className="flex gap-1 mt-1.5 flex-nowrap overflow-x-auto scrollbar-hide">
                           {dailyAccommodation.hasBreakfast && (
                             <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1 shrink-0"><Coffee size={8}/>含早餐</span>
                           )}
                           {dailyAccommodation.hasDinner && (
                             <span className="bg-amber-50 text-amber-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-amber-100 flex items-center gap-1 shrink-0"><Soup size={8}/>含晚餐</span>
                           )}
                         </div>
                       )}
                    </div>
                    {dailyAccommodation && (
                      <a 
                        href={dailyAccommodation.mapLink || getMapSearchUrl(dailyAccommodation.name, dailyAccommodation.jpName)} 
                        target="_blank" 
                        onClick={e => e.stopPropagation()} 
                        className="absolute top-3 right-3 p-1.5 bg-indigo-50 text-indigo-500 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors"
                      >
                        <MapPinned size={12}/>
                      </a>
                    )}
                  </div>
                  <div className="w-1/4 bg-white p-3 rounded-[28px] shadow-sm border border-gray-50 flex flex-col items-center justify-center">
                    <span className="text-[8px] font-black text-blue-400 uppercase mb-0.5 truncate w-full text-center">{currentDay.location}</span>
                    <div className="text-blue-500 mb-0.5">
                      {currentDay.weather === 'snow' ? <Snowflake size={16}/> : currentDay.weather === 'sunny' ? <Sun size={16}/> : <Cloud size={16}/>}
                    </div>
                    <span className="text-[14px] font-black tabular-nums">{currentDay.temp}</span>
                  </div>
                </div>

                <div className="relative space-y-3 pl-3 pt-1">
                  <div className="absolute left-[11px] top-6 bottom-6 w-0.5 border-l-2 border-dashed border-slate-200"></div>
                  {sortedSpots.filter(s => s.category !== 'hotel').map((spot) => {
                    const cfg = CATEGORY_MAP[spot.category] || CATEGORY_MAP.other;
                    const hasCost = (spot.adultCost || 0) > 0 || (spot.childCost || 0) > 0;
                    return (
                      <div key={spot.id} onClick={() => setEditingSpot(spot)} className="relative group cursor-pointer active:scale-[0.99] transition-all">
                        <div className="absolute left-[-11px] top-6 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-sm z-10"></div>
                        <div className="pl-5">
                           <div className={`bg-white p-3.5 rounded-[24px] shadow-sm border transition-all ${isEditMode ? 'border-orange-200 bg-orange-50/10' : 'border-gray-50'} hover:shadow-md`}>
                              <div className="flex justify-between items-start mb-0.5">
                                 <div className="flex items-center gap-2">
                                    <div className="text-[10px] font-black text-blue-500 uppercase tabular-nums">{spot.time}</div>
                                    {spot.mealType && (
                                       <span className="bg-orange-50 text-orange-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-orange-100 flex items-center gap-1 leading-none uppercase">
                                          {MEAL_LABELS[spot.mealType]}
                                       </span>
                                    )}
                                 </div>
                                 <div className={`p-1.5 rounded-lg ${cfg.bg} ${cfg.color}`}>{React.createElement(cfg.icon, {size: 13})}</div>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <h4 className="text-[16px] font-black text-gray-900 leading-tight truncate">{spot.name}</h4>
                                {spot.isBooked && <div className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-lg border border-emerald-100 text-[8px] font-black shrink-0 flex items-center gap-1"><BookmarkCheck size={9}/> {spot.booker || '已訂'}</div>}
                              </div>
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                 {hasCost && (
                                   <div className="text-[9px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-slate-100 tabular-nums">
                                     <Banknote size={10}/>
                                     {spot.adultCost! > 0 && <span>大 ¥{spot.adultCost!.toLocaleString()}</span>}
                                     {spot.childCost! > 0 && <span> / 小 ¥{spot.childCost!.toLocaleString()}</span>}
                                   </div>
                                 )}
                                 {spot.isCashOnly && <div className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">Cash Only</div>}
                                 {spot.links && spot.links.length > 0 && <div className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100 flex items-center gap-1"><LinkIcon size={9}/> {spot.links.length} 連結</div>}
                              </div>
                           </div>
                        </div>
                      </div>
                    );
                  })}
                  {isEditMode && (
                    <button onClick={() => { 
                      const ns: Spot = { id: `s-${Date.now()}`, name: '新項目', jpName: '', time: '12:00', description: '', category: 'spot', images: [], files: [], links: [] }; 
                      const newDays = state.days.map(d => d.dayNum === selectedDayNum ? { ...d, spots: [...d.spots, ns] } : d);
                      pushUpdate({ days: newDays }); 
                      setEditingSpot(ns); 
                    }} className="ml-5 w-[calc(100%-20px)] py-5 border-2 border-dashed border-gray-200 rounded-[28px] text-gray-300 font-black text-xs flex items-center justify-center gap-2 bg-white/50 active:bg-gray-100 transition-colors"><Plus size={18}/> 新增項目</button>
                  )}
                </div>
             </div>
          </div>
        )}
        {activeTab === 'split' && <ExpensesTab expenses={state.expenses} members={state.members} exchangeRate={state.exchangeRate} onUpdate={e => pushUpdate({expenses: e})} onUpdateMembers={m => pushUpdate({members: m})} onUpdateRate={r => pushUpdate({exchangeRate: r})} />}
        {activeTab === 'ai' && <AIHelperTab aiItems={state.aiItems} onUpdateItems={it => pushUpdate({aiItems: it})} exchangeRate={state.exchangeRate} />}
      </div>

      <div className="fixed bottom-8 left-6 right-6 bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-[36px] px-2 py-2 flex justify-around items-center z-[100]">
        {[ { id: 'plan', icon: List, label: '行程' }, { id: 'split', icon: ReceiptText, label: '分帳' }, { id: 'ai', icon: Sparkles, label: 'AI' } ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex flex-col items-center gap-1 py-4 rounded-[28px] flex-1 transition-all ${activeTab === t.id ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400'}`}>
            <t.icon size={22} /><span className="text-[11px] font-black uppercase tracking-wider">{t.label}</span>
          </button>
        ))}
      </div>

      {editingSpot && (
        <div className="fixed inset-0 z-[500] bg-black/75 backdrop-blur-md flex items-end justify-center animate-fade-in" onClick={() => { setEditingSpot(null); setCurrentImgIndex(0); }}>
          <div className="bg-white w-full max-w-lg rounded-t-[48px] overflow-hidden flex flex-col shadow-2xl max-h-[95vh] animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className={`p-6 border-b flex justify-between items-center transition-colors ${CATEGORY_MAP[editingSpot.category]?.bg || 'bg-blue-50'}`}>
               <div className="flex-1 truncate pr-8">
                 {isEditMode ? (
                    <div className="space-y-3">
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {CATEGORY_OPTIONS.map(opt => (
                          <button key={opt.value} onClick={() => updateSpotInState({...editingSpot, category: opt.value})} className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black border transition-all ${editingSpot.category === opt.value ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white text-slate-400 border-slate-100'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <input className="text-xl font-black w-full bg-transparent outline-none border-b border-blue-200 pb-1 focus:border-blue-500" value={editingSpot.name} onChange={e => updateSpotInState({...editingSpot, name: e.target.value})} placeholder="名稱 (中文)" />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="text-[12px] font-bold w-full bg-transparent outline-none text-slate-400 border-b border-slate-100" value={editingSpot.jpName || ''} onChange={e => updateSpotInState({...editingSpot, jpName: e.target.value})} placeholder="日文名稱" />
                        <input className="text-[12px] font-bold w-full bg-transparent outline-none text-slate-400 border-b border-slate-100" value={editingSpot.enName || ''} onChange={e => updateSpotInState({...editingSpot, enName: e.target.value})} placeholder="英文名稱" />
                      </div>
                    </div>
                 ) : (
                    <div>
                      <div className={`text-[10px] font-black uppercase mb-0.5 tracking-widest ${CATEGORY_MAP[editingSpot.category]?.color}`}>{CATEGORY_MAP[editingSpot.category]?.label}</div>
                      <h2 className="text-xl font-black text-gray-900 truncate leading-tight">{editingSpot.name}</h2>
                      {(editingSpot.jpName || editingSpot.enName) && <div className="text-[12px] font-bold text-slate-400 italic mt-0.5">{editingSpot.jpName} {editingSpot.enName && `· ${editingSpot.enName}`}</div>}
                    </div>
                 )}
               </div>
               <button onClick={() => { setEditingSpot(null); setCurrentImgIndex(0); }} className="p-3 bg-white rounded-2xl shadow-sm border shrink-0 active:scale-90 transition-all"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto scrollbar-hide pb-24 text-left">
               <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ImageIcon size={14}/> 媒體內容</div>
                    {isEditMode && <div className="flex gap-2">
                      <button onClick={() => photoInputRef.current?.click()} className="text-[10px] font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-full">上傳照片</button>
                      <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">上傳檔案</button>
                    </div>}
                  </div>
                  {((editingSpot.images && editingSpot.images.length > 0) || (editingSpot.files && editingSpot.files.length > 0)) ? (
                    <div className="space-y-3">
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x" onScroll={handleScroll}>
                         {editingSpot.images?.map((img, i) => (
                           <div key={i} className="relative shrink-0 w-full h-48 rounded-[28px] overflow-hidden shadow-sm snap-center border-2 border-white">
                              <img src={img} className="w-full h-full object-cover" />
                              {isEditMode && <button onClick={() => updateSpotInState({...editingSpot, images: editingSpot.images.filter((_, idx) => idx !== i)})} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-xl shadow-lg"><Trash2 size={14}/></button>}
                           </div>
                         ))}
                         {editingSpot.files?.map((f, i) => (
                           <div key={i} className="shrink-0 w-full h-48 bg-indigo-50 rounded-[28px] border border-indigo-100 p-4 flex flex-col justify-between snap-center">
                              <div className="flex items-center gap-2 truncate">
                                 <FileText size={20} className="text-indigo-400"/>
                                 <span className="text-xs font-black text-indigo-900 truncate">{f.name}</span>
                              </div>
                              <div className="flex gap-2">
                                 <a href={f.data} download={f.name} className="flex-1 py-3 bg-white text-indigo-600 rounded-xl text-[12px] font-black text-center shadow-sm">下載檔案</a>
                                 {isEditMode && <button onClick={() => updateSpotInState({...editingSpot, files: editingSpot.files.filter((_, idx) => idx !== i)})} className="p-3 bg-red-100 text-red-600 rounded-xl"><Trash2 size={16}/></button>}
                              </div>
                           </div>
                         ))}
                      </div>
                      {((editingSpot.images?.length || 0) + (editingSpot.files?.length || 0)) > 1 && (
                        <div className="flex justify-center gap-1.5">
                          {Array.from({ length: (editingSpot.images?.length || 0) + (editingSpot.files?.length || 0) }).map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${currentImgIndex === i ? 'bg-indigo-600 w-3' : 'bg-slate-200'}`}></div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : <div className="h-24 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[24px] flex items-center justify-center text-slate-300 font-bold text-xs">尚無照片或檔案</div>}
               </div>

               {(isEditMode || (editingSpot.links && editingSpot.links.length > 0)) && (
                 <div className="bg-slate-50/80 p-5 rounded-[28px] border border-slate-100 space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ExternalLink size={12}/> 行程連結</span>
                      {isEditMode && <button onClick={() => updateSpotInState({...editingSpot, links: [...(editingSpot.links || []), {title: '', url: ''}]})} className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1"><Plus size={10}/> 新增</button>}
                    </div>
                    <div className="space-y-2">
                      {editingSpot.links?.map((link, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
                          {isEditMode ? (
                            <>
                              <div className="flex justify-between gap-2">
                                <input className="flex-1 text-[12px] font-black outline-none bg-slate-50 p-2 rounded-xl" value={link.title} onChange={e => {
                                  const nl = [...editingSpot.links!]; nl[idx].title = e.target.value; updateSpotInState({...editingSpot, links: nl});
                                }} placeholder="標題 (例: 官網、票價)" />
                                <button onClick={() => updateSpotInState({...editingSpot, links: editingSpot.links!.filter((_, i) => i !== idx)})} className="text-rose-500 p-1"><Trash2 size={16}/></button>
                              </div>
                              <input className="text-[11px] outline-none bg-slate-50 p-2 rounded-xl text-blue-500" value={link.url} onChange={e => {
                                const nl = [...editingSpot.links!]; nl[idx].url = e.target.value; updateSpotInState({...editingSpot, links: nl});
                              }} placeholder="https://..." />
                            </>
                          ) : (
                            <a href={link.url} target="_blank" className="flex items-center justify-between group py-1">
                              <span className="text-[13px] font-black text-slate-700">{link.title || link.url}</span>
                              <ExternalLink size={14} className="text-blue-500 group-hover:translate-x-1 transition-transform"/>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                 </div>
               )}

               <div className="bg-white p-5 rounded-[28px] border border-slate-100 space-y-4 shadow-sm">
                  <div className="flex items-center gap-4">
                     <Clock size={20} className="text-blue-500"/>
                     <div className="flex-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">時間</span>
                        {isEditMode ? <input type="time" className="font-black text-xl bg-slate-50 border border-slate-100 rounded-xl p-2 w-full outline-none" value={editingSpot.time} onChange={e => updateSpotInState({...editingSpot, time: e.target.value})} /> : <div className="font-black text-xl tabular-nums">{editingSpot.time}</div>}
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5"><Edit3 size={12}/> 備註內容</label>
                     {isEditMode ? (
                        <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl min-h-[100px] font-bold text-sm shadow-inner outline-none" value={editingSpot.description} onChange={e => updateSpotInState({...editingSpot, description: e.target.value})} />
                     ) : <div className="text-sm font-medium text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-50">{editingSpot.description || '無備註資訊'}</div>}
                  </div>
               </div>

               {editingSpot.category === 'hotel' && (
                 <div className="bg-indigo-50/50 p-5 rounded-[28px] border border-indigo-100 space-y-4">
                    <div className="flex justify-between items-center">
                       <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5"><BedDouble size={14}/> 住宿詳情</div>
                       <div className="flex gap-1.5">
                          <button onClick={() => updateSpotInState({...editingSpot, hasBreakfast: !editingSpot.hasBreakfast})} className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${editingSpot.hasBreakfast ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-300'}`}>含早餐</button>
                          <button onClick={() => updateSpotInState({...editingSpot, hasDinner: !editingSpot.hasDinner})} className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${editingSpot.hasDinner ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-300'}`}>含晚餐</button>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">Check-in</label>
                          {isEditMode ? <input className="w-full bg-white p-2.5 rounded-xl font-bold border border-indigo-50 outline-none" value={editingSpot.checkIn || ''} onChange={e => updateSpotInState({...editingSpot, checkIn: e.target.value})} placeholder="15:00" /> : <div className="font-black text-sm">{editingSpot.checkIn || '--'}</div>}
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">Check-out</label>
                          {isEditMode ? <input className="w-full bg-white p-2.5 rounded-xl font-bold border border-indigo-50 outline-none" value={editingSpot.checkOut || ''} onChange={e => updateSpotInState({...editingSpot, checkOut: e.target.value})} placeholder="11:00" /> : <div className="font-black text-sm">{editingSpot.checkOut || '--'}</div>}
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">訂房人</label>
                          {isEditMode ? (
                            <select className="w-full bg-white p-2.5 rounded-xl font-bold border border-indigo-50 outline-none" value={editingSpot.booker || ''} onChange={e => updateSpotInState({...editingSpot, booker: e.target.value})}>
                              <option value="">請選擇</option>
                              {FAMILY_HEADS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          ) : <div className="font-black text-sm">{editingSpot.booker || '未設定'}</div>}
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">預訂狀態</label>
                          <button onClick={() => updateSpotInState({...editingSpot, isBooked: !editingSpot.isBooked})} className={`w-full py-2.5 rounded-xl text-[10px] font-black border transition-all ${editingSpot.isBooked ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white text-slate-300'}`}>
                            {editingSpot.isBooked ? '已預訂' : '未預訂'}
                          </button>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[8px] font-black text-slate-400 uppercase">訂房總金額</label>
                       <div className="flex gap-2 mb-1.5">
                          {['JPY', 'TWD'].map(c => <button key={c} onClick={() => updateSpotInState({...editingSpot, hotelCurrency: c as any})} className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all ${editingSpot.hotelCurrency === c ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-400'}`}>{c}</button>)}
                       </div>
                       {isEditMode ? <input type="number" className="w-full bg-white p-3 rounded-xl font-black border border-indigo-50 outline-none" value={editingSpot.hotelPrice || ''} onChange={e => updateSpotInState({...editingSpot, hotelPrice: parseInt(e.target.value) || 0})} /> : <div className="text-lg font-black">{editingSpot.hotelCurrency === 'JPY' ? '¥' : '$'}{(editingSpot.hotelPrice || 0).toLocaleString()}</div>}
                    </div>
                 </div>
               )}

               {(editingSpot.category === 'spot' || editingSpot.category === 'food' || editingSpot.category === 'transport') && (
                 <div className={`p-5 rounded-[28px] border space-y-4 ${editingSpot.category === 'transport' ? 'bg-orange-50/50 border-orange-100' : editingSpot.category === 'food' ? 'bg-rose-50/50 border-rose-100' : 'bg-blue-50/50 border-blue-100'}`}>
                    <div className="flex justify-between items-center">
                       <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${CATEGORY_MAP[editingSpot.category].color}`}>{React.createElement(CATEGORY_MAP[editingSpot.category].icon, {size:14})} {CATEGORY_MAP[editingSpot.category].label}詳情</div>
                       <div className="flex gap-1.5">
                          {editingSpot.category === 'food' && (
                            <div className="flex gap-1">
                              {Object.keys(MEAL_LABELS).map(m => (
                                <button key={m} onClick={() => updateSpotInState({...editingSpot, mealType: m as MealType})} className={`px-2 py-1 rounded-lg text-[8px] font-black border ${editingSpot.mealType === m ? 'bg-rose-500 text-white' : 'bg-white text-slate-300'}`}>{MEAL_LABELS[m as MealType]}</button>
                              ))}
                            </div>
                          )}
                          <button onClick={() => updateSpotInState({...editingSpot, isBooked: !editingSpot.isBooked})} className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${editingSpot.isBooked ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white text-slate-300'}`}>{editingSpot.isBooked ? '已預約' : '未預約'}</button>
                       </div>
                    </div>
                    {editingSpot.category === 'transport' && (
                      <div className="grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase">起點 (上車點)</label>
                            {isEditMode ? <input className="w-full bg-white p-2.5 rounded-xl font-bold border border-slate-100 outline-none" value={editingSpot.departure || ''} onChange={e => updateSpotInState({...editingSpot, departure: e.target.value})} /> : <div className="font-black text-sm">{editingSpot.departure || '--'}</div>}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase">終點 (下車點)</label>
                            {isEditMode ? <input className="w-full bg-white p-2.5 rounded-xl font-bold border border-slate-100 outline-none" value={editingSpot.arrival || ''} onChange={e => updateSpotInState({...editingSpot, arrival: e.target.value})} /> : <div className="font-black text-sm">{editingSpot.arrival || '--'}</div>}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">預估行車時間</label>
                          {isEditMode ? <input className="w-full bg-white p-2.5 rounded-xl font-bold border border-slate-100 outline-none" value={editingSpot.duration || ''} onChange={e => updateSpotInState({...editingSpot, duration: e.target.value})} placeholder="30m" /> : <div className="font-black text-sm">{editingSpot.duration || '--'}</div>}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">大人單價 (¥)</label>
                          {isEditMode ? <input type="number" className="w-full bg-white p-2.5 rounded-xl font-black border border-slate-100 outline-none" value={editingSpot.adultCost || ''} onChange={e => updateSpotInState({...editingSpot, adultCost: parseInt(e.target.value) || 0})} /> : <div className="font-black">¥{(editingSpot.adultCost || 0).toLocaleString()}</div>}
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase">兒童單價 (¥)</label>
                          {isEditMode ? <input type="number" className="w-full bg-white p-2.5 rounded-xl font-black border border-slate-100 outline-none" value={editingSpot.childCost || ''} onChange={e => updateSpotInState({...editingSpot, childCost: parseInt(e.target.value) || 0})} /> : <div className="font-black">¥{(editingSpot.childCost || 0).toLocaleString()}</div>}
                       </div>
                    </div>
                    {(isEditMode || editingSpot.isBooked) && (
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase">預約/訂位人</label>
                        {isEditMode ? (
                          <select className="w-full bg-white p-2.5 rounded-xl font-bold border border-slate-100 outline-none" value={editingSpot.booker || ''} onChange={e => updateSpotInState({...editingSpot, booker: e.target.value})}>
                            <option value="">請選擇</option>
                            {FAMILY_HEADS.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        ) : <div className="font-black text-sm">{editingSpot.booker || '--'}</div>}
                      </div>
                    )}
                 </div>
               )}

               <div className="flex flex-col gap-3">
                  {!isEditMode && editingSpot.mapLink && <a href={editingSpot.mapLink} target="_blank" className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[16px] font-black flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><Navigation size={18}/> 地圖導航</a>}
                  <button onClick={() => { setEditingSpot(null); setCurrentImgIndex(0); }} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[16px] font-black active:scale-95 transition-all">關閉詳細視窗</button>
               </div>
            </div>
            <input type="file" ref={photoInputRef} className="hidden" accept="image/*" multiple onChange={(e) => handleMediaUpload(e, 'img')} />
            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => handleMediaUpload(e, 'file')} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(35px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-scale-in { animation: scaleIn 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
};

const INITIAL_DATA: AppState = {
  exchangeRate: 0.215,
  members: [
    { id: 'm1', name: 'Sandy', family: 'Sandy', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sandy' },
    { id: 'm2', name: '小咪', family: 'Sandy', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Mimi' },
    { id: 'm3', name: '英茵', family: '英茵', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Yin' },
    { id: 'm4', name: '諾一', family: '英茵', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Nuo' },
    { id: 'm5', name: '悅希', family: '英茵', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Yue' },
  ],
  expenses: [], aiItems: [],
  days: [
    {
      dayNum: 1, date: '2026-01-11', location: '札幌', weather: 'snow', temp: '-3°C',
      spots: [
        { id: '1-hotel', name: 'Vessel Inn 札幌中島公園', jpName: 'ベッセルイン札幌中島公園', time: '15:45', description: '札幌中島公園。全日本最強早餐之一！', category: 'hotel', booker: '英茵', isBooked: true, images: [], files: [], checkIn: '15:00', checkOut: '11:00', hasBreakfast: true, hotelCurrency: 'JPY', hotelPrice: 22025, mapLink: 'https://maps.app.goo.gl/9yGvX3fR1z3Z3y2u8', links: [] },
        { id: '1-1', name: '機場接送出發', jpName: '', time: '03:00', description: '住家出發前往第一航廈', category: 'transport', departure: '住家', arrival: '桃園第一航廈', duration: '30m', images: [], files: [], links: [] },
        { id: '1-2', name: '第一航廈集合', jpName: '', time: '03:30', description: '櫃檯報到集合', category: 'meetup', booker: 'Sandy', images: [], files: [], links: [] },
        { id: '1-3', name: '午餐-新千歲機場', jpName: '', time: '11:30', description: '機場食集補充能量', category: 'food', mealType: 'lunch', adultCost: 3000, childCost: 2000, images: [], files: [], links: [] },
        { id: '1-4', name: '機場巴士直行', jpName: '空港連絡バス', time: '14:16', description: '札幌都心直行便', category: 'transport', departure: '新千歲機場', arrival: '札幌中島公園', duration: '80m', adultCost: 1300, childCost: 650, images: [], files: [], routeLink: 'https://maps.app.goo.gl/uSrH9H8mG6uLU6S89', links: [] },
        { id: '1-5', name: '札幌巡遊', jpName: '', time: '16:00', description: '狸小路、薄野散策', category: 'spot', images: [], files: [], links: [] },
        { id: '1-6', name: '晚餐-炉端燒くし爐', jpName: '炉端燒くし爐', time: '19:30', description: '炭火傳統美味，需預訂', category: 'food', mealType: 'dinner', adultCost: 6000, childCost: 3000, isBooked: true, booker: '英茵', images: [], files: [], links: [] }
      ]
    },
    {
      dayNum: 2, date: '2026-01-12', location: '美唄', weather: 'snow', temp: '-5°C',
      spots: [
        { id: '2-hotel', name: 'Vessel Inn 札幌中島公園', jpName: 'ベッセルイン札幌中島公園', time: '00:00', description: '續住第二晚', category: 'hotel', booker: '英茵', isBooked: true, images: [], files: [], hasBreakfast: true, links: [] },
        { id: '2-1', name: '前往美唄雪地', jpName: '', time: '08:46', description: '快速機場號轉美唄', category: 'transport', departure: '札幌', arrival: '美唄', duration: '55m', adultCost: 3270, childCost: 3270, images: [], files: [], links: [] },
        { id: '2-2', name: '美唄雪地樂園', jpName: '美唄雪遊び', time: '10:10', description: '無限玩套票：雪地漂流、摩托車、香蕉船', category: 'spot', adultCost: 5000, childCost: 3000, images: [], files: [], links: [{title: '樂園官網', url: 'https://www.bibai-snowland.com/'}] },
        { id: '2-3', name: '晚餐-螃蟹大餐', jpName: '札幌かに本家', time: '18:00', description: '螃蟹宴，豪華螃蟹席', category: 'food', mealType: 'dinner', adultCost: 10000, childCost: 2800, isBooked: true, booker: '英茵', images: [], files: [], links: [] }
      ]
    },
    {
      dayNum: 3, date: '2026-01-13', location: '定山溪', weather: 'cloudy', temp: '-2°C',
      spots: [
        { id: '3-hotel', name: '定山溪豪景飯店', jpName: '定山溪ビューホテル', time: '14:50', description: '大型溫泉飯店，含溫泉樂園', category: 'hotel', booker: '英茵', isBooked: true, images: [], files: [], hasBreakfast: true, hasDinner: true, links: [] },
        { id: '3-1', name: '中島公園滑雪體驗', jpName: '', time: '08:30', description: '租借工具簡易體驗', category: 'spot', images: [], files: [], links: [] },
        { id: '3-2', name: '飯店免費接駁車', jpName: '', time: '14:00', description: '札幌站北口集合', category: 'transport', departure: '札幌站', arrival: '定山溪', duration: '50m', images: [], files: [], links: [] },
        { id: '3-3', name: '定山溪營火烤肉', jpName: '心の里埜のてらす', time: '19:30', description: '焚き火晚宴', category: 'food', mealType: 'dinner', adultCost: 3000, childCost: 3000, images: [], files: [], links: [] }
      ]
    },
    {
      dayNum: 4, date: '2026-01-14', location: '定山溪', weather: 'snow', temp: '-4°C',
      spots: [
        { id: '4-hotel', name: '定山溪豪景飯店', jpName: '定山溪ビューホテル', time: '00:00', description: '續住第二晚', category: 'hotel', booker: '英茵', isBooked: true, images: [], files: [], hasBreakfast: true, hasDinner: true, links: [] },
        { id: '4-1', name: '溫泉街散策', jpName: '', time: '09:00', description: '悠閒散步與手湯體驗', category: 'spot', images: [], files: [], links: [] },
        { id: '4-2', name: '定山溪雪地漂流', jpName: 'スノーラフティング', time: '14:30', description: '刺激雪上快感', category: 'spot', adultCost: 10000, childCost: 9000, images: [], files: [], links: [] }
      ]
    },
    {
      dayNum: 5, date: '2026-01-15', location: '札幌', weather: 'sunny', temp: '0°C',
      spots: [
        { id: '5-hotel', name: '京王廣場飯店', jpName: '京王プラザホテル札幌', time: '17:00', description: '札幌站旁，豪華地標飯店', category: 'hotel', booker: 'Sandy', isBooked: true, images: [], files: [], hasBreakfast: true, links: [] },
        { id: '5-1', name: '札幌國際滑雪場', jpName: '札幌國際スキー場', time: '10:00', description: '滑雪一日全套票', category: 'spot', adultCost: 26900, childCost: 21600, images: [], files: [], links: [{title: '滑雪場官網', url: 'https://www.sapporo-kokusai.jp/'}] },
        { id: '5-2', name: '滑雪場專車回程', jpName: '', time: '15:30', description: '直達飯店', category: 'transport', departure: '滑雪場', arrival: '京王廣場飯店', duration: '1h', images: [], files: [], links: [] }
      ]
    },
    {
      dayNum: 6, date: '2026-01-16', location: '小樽', weather: 'snow', temp: '-1°C',
      spots: [
        { id: '6-hotel', name: '京王廣場飯店', jpName: '京王プラザホテル札幌', time: '00:00', description: '續住第二晚', category: 'hotel', booker: 'Sandy', isBooked: true, images: [], files: [], hasBreakfast: true, links: [] },
        { id: '6-1', name: '前往小樽', jpName: '', time: '09:10', description: 'JR 快速機場號', category: 'transport', departure: '札幌', arrival: '小樽', duration: '35m', adultCost: 1670, childCost: 1670, images: [], files: [], links: [] },
        { id: '6-2', name: '和服體驗', jpName: '乙女のきもの', time: '10:15', description: '小樽懷舊散策', category: 'spot', adultCost: 4980, childCost: 4980, images: [], files: [], links: [] },
        { id: '6-3', name: '午餐-三角市場', jpName: '三角市場', time: '12:00', description: '豪邁海鮮丼', category: 'food', mealType: 'lunch', adultCost: 6000, childCost: 3000, images: [], files: [], links: [] },
        { id: '6-4', name: '晚餐-小樽牛排飯', jpName: 'cafe BAAL', time: '17:30', description: '在地人氣名店', category: 'food', mealType: 'dinner', adultCost: 2000, childCost: 2000, images: [], files: [], links: [] }
      ]
    },
    {
      dayNum: 7, date: '2026-01-17', location: '台北', weather: 'sunny', temp: '18°C',
      spots: [
        { id: '7-hotel', name: '返程台北', jpName: '', time: '20:30', description: '甜蜜的家', category: 'hotel', booker: '自己', isBooked: false, images: [], files: [], links: [] },
        { id: '7-1', name: '最後採買', jpName: '', time: '08:50', description: '機場伴手禮補貨', category: 'shopping', images: [], files: [], links: [] },
        { id: '7-2', name: '機場巴士', jpName: '空港連絡バス', time: '07:25', description: '飯店直達機場', category: 'transport', departure: '京王廣場飯店', arrival: '新千歲機場', duration: '82m', adultCost: 1300, childCost: 650, images: [], files: [], links: [] }
      ]
    }
  ]
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
