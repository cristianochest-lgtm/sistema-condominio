import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc,
  doc,
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ClipboardList, 
  Building2, 
  Calendar, 
  Clock, 
  Truck, 
  CheckCircle2, 
  AlertCircle,
  Trash2
} from 'lucide-react';

// Código para gerar o ícone de edifício em Base64 (SVG) para o favicon
const buildingSvgBase64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzFkNGVkOCI+PHBhdGggZD0iTTEyIDJMMzA3djEwbDlNNzVMMTUgMjVMMTUgMjVNNy43OCA1LjU2VjcuNzhMMTMgMTUuMzNMMTcgMTMuMTF2LTQuNDRMMTIgMTEiLz48L3N2Zz4='; 

/* -------------------------
   FIREBASE - variáveis VITE
   (definidas na Vercel / .env.local)
-------------------------- */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Aviso se faltar variáveis (útil em dev)
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  // Não impede o app de arrancar, só ajuda a diagnosticar
  // eslint-disable-next-line no-console
  console.warn('[Firebase] algumas variáveis VITE_FIREBASE_* não foram encontradas.');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// appId usado no path do Firestore — pode ser sobrescrito por VITE_APP_ID se quiser
const appId = import.meta.env.VITE_APP_ID || firebaseConfig.projectId;

/* -------------------------
   COMponente App
-------------------------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    company: '',
    serviceDate: new Date().toISOString().split('T')[0],
    serviceTime: '',
    notes: ''
  });

  // 0. Configurações de Aparência e Favicon
  useEffect(() => {
    document.title = "Condomínio Gilles Deleuze";

    const setFavicon = () => {
      const existingIcons = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
      existingIcons.forEach(icon => icon.remove());

      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.href = buildingSvgBase64;
      document.head.appendChild(link);
    };
    setFavicon();
  }, []);

  // 1. Autenticação (usa token customizado se houver, senão anônimo)
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = import.meta.env.VITE_INITIAL_AUTH_TOKEN || null;
        if (token) {
          // tenta login com token customizado
          await signInWithCustomToken(auth, token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Auth Error:", error);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Leitura de Dados em Tempo Real
  useEffect(() => {
    if (!user) return;

    const ordersCollection = collection(db, 'artifacts', appId, 'public', 'data', 'service_orders');

    const unsubscribe = onSnapshot(ordersCollection, (snapshot) => {
      const loadedOrders = snapshot.docs.map(docItem => ({
        id: docItem.id,
        ...docItem.data()
      }));

      // Ordena do mais novo para o mais antigo (tenta usar createdAt se disponível)
      loadedOrders.sort((a, b) => {
        const timeA = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds * 1000 : Date.parse(`${a.serviceDate}T${a.serviceTime || '00:00'}`);
        const timeB = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds * 1000 : Date.parse(`${b.serviceDate}T${b.serviceTime || '00:00'}`);
        return timeB - timeA;
      });

      setOrders(loadedOrders);
      setLoading(false);
    }, (error) => {
      // eslint-disable-next-line no-console
      console.error("Data Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Manipular mudanças no formulário
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 3. Salvar (Create)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    try {
      const ordersCollection = collection(db, 'artifacts', appId, 'public', 'data', 'service_orders');

      await addDoc(ordersCollection, {
        company: formData.company,
        serviceDate: formData.serviceDate,
        serviceTime: formData.serviceTime,
        notes: formData.notes,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });

      setFormData({
        company: '',
        serviceDate: new Date().toISOString().split('T')[0],
        serviceTime: '',
        notes: ''
      });
      setSuccessMsg('Registro salvo com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Save Error:", error);
      window.alert("Erro de conexão ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Excluir (Delete)
  const handleDelete = async (id) => {
    if (!window.confirm("Confirmar exclusão deste registro?")) return;

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'service_orders', id);
      await deleteDoc(docRef);
      setSuccessMsg('Registro removido.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Delete Error:", error);
      window.alert("Erro ao excluir.");
    }
  };

  if (!user && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-slate-500 gap-2 font-medium">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        Carregando Sistema...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-10">
      
      {/* Cabeçalho Profissional */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            
            {/* LOGOTIPO: Ícone de Prédio Simples e Profissional */}
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm flex-shrink-0">
              <Building2 size={24} />
            </div>
            {/* FIM DO LOGOTIPO */}

            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-none">Condomínio Gilles Deleuze</h1>
              <span className="text-xs text-slate-500 font-medium tracking-wide uppercase mt-1 block">Sistema de Portaria v1.0</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Online
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        
        {/* Formulário */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="text-blue-600" size={20} />
              <h2 className="font-semibold text-base text-slate-700">Novo Registro</h2>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Empresa / Prestador</label>
              <div className="relative">
                <Truck className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input
                  required
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Nome da empresa ou técnico..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    required
                    type="date"
                    name="serviceDate"
                    value={formData.serviceDate}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horário</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    required
                    type="time"
                    name="serviceTime"
                    val
