import React, { useState, useEffect } from 'react';
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
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { 
  Building2, 
  User, 
  Home, 
  Trash2,
  AlertCircle,
  CheckCircle2,
  X 
} from 'lucide-react';

// --- Variáveis de Ambiente e Configuração ---
// As configurações do Firebase e variáveis de autenticação são fornecidas pelo ambiente.
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Código para gerar o ícone de edifício em Base64 (SVG) para o favicon
const buildingSvgBase64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzFkNGVkOCI+PHBhdGggZD0iTTEyIDJMMzA3djEwbDlNNzVMMTUgMjVMMTUgMjVNNy43OCA1LjU2VjcuNzhMMTMgMTUuMzNMMTcgMTMuMTF2LTQuNDRMMTIgMTEiLz48L3N2Zz4='; 

// Componente de Modal de Confirmação (Substitui window.confirm)
const ConfirmModal = ({ visible, message, onConfirm, onCancel }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <AlertCircle className="text-red-500" size={20} />
          Confirmação
        </h3>
        <p className="text-sm text-slate-600">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition shadow-md hover:shadow-lg"
          >
            Confirmar Exclusão
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------
    Componente Principal App
-------------------------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [notification, setNotification] = useState({ message: '', type: '', visible: false });
  
  const [confirmDialog, setConfirmDialog] = useState({
    visible: false,
    message: '',
    actionId: null,
    onConfirm: () => {}
  });

  // Estado para os novos campos: nome, bloco, apartamento
  const [formData, setFormData] = useState({
    nome: '',
    bloco: '',
    apartamento: '',
  });

  // Função para mostrar notificações (Substitui window.alert)
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type, visible: true });
    setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 4000);
  };

  // 0. Configurações de Aparência e Favicon
  useEffect(() => {
    document.title = "Condomínio - Cadastro de Moradores";
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

  // 1. Autenticação 
  useEffect(() => {
    const initAuth = async () => {
      try {
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Leitura de Dados em Tempo Real (onSnapshot)
  useEffect(() => {
    if (!user) return;
    
    // Coleção pública para ser acessível por todos os usuários do app
    const residentsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'residents');

    const unsubscribe = onSnapshot(residentsCollection, (snapshot) => {
      const loadedResidents = snapshot.docs.map(docItem => ({
        id: docItem.id,
        ...docItem.data()
      }));

      // Mantém a ordem pela data de criação (ou usa a ordem padrão do Firebase)
      loadedResidents.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      setResidents(loadedResidents);
      setLoading(false);
    }, (error) => {
      console.error("Data Error:", error);
      setLoading(false);
      showNotification("Erro ao carregar dados: " + error.message, 'error');
    });

    return () => unsubscribe();
  }, [user]);

  // Manipular mudanças no formulário
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 3. Salvar Morador (Create)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.nome || !formData.bloco || !formData.apartamento) {
        showNotification("Por favor, preencha todos os campos obrigatórios.", 'error');
        return;
    }
    setSubmitting(true);

    try {
      const residentsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'residents');

      await addDoc(residentsCollection, {
        nome: formData.nome,
        bloco: formData.bloco,
        apartamento: formData.apartamento,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });

      // Limpar formulário após o sucesso
      setFormData({ nome: '', bloco: '', apartamento: '' });
      showNotification('Morador registrado com sucesso!', 'success'); 

    } catch (error) {
      console.error("Save Error:", error);
      showNotification("Erro ao salvar morador: " + error.message, 'error'); 
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Excluir Morador (Delete) - Etapa 1: Abrir Modal
  const initiateDelete = (id, nome) => {
    setConfirmDialog({
      visible: true,
      message: `Tem certeza que deseja excluir o morador ${nome}?`,
      actionId: id,
      onConfirm: () => {
        executeDelete(id);
        setConfirmDialog({ visible: false, message: '', actionId: null, onConfirm: () => {} });
      }
    });
  };

  // 4. Excluir Morador (Delete) - Etapa 2: Executar Exclusão
  const executeDelete = async (id) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'residents', id);
      await deleteDoc(docRef);
      showNotification('Morador removido.', 'success');
    } catch (error) {
      console.error("Delete Error:", error);
      showNotification("Erro ao excluir: " + error.message, 'error');
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

  // Estilos da Notificação
  const notificationClasses = notification.type === 'success' 
    ? "bg-green-50 text-green-700 border-green-200" 
    : "bg-red-50 text-red-700 border-red-200";

  const notificationIcon = notification.type === 'success' 
    ? <CheckCircle2 size={16} /> 
    : <AlertCircle size={16} />;


  return (
    <div className="min-h-screen bg-gray-100 font-sans text-slate-800 pb-10">
      
      {/* Modal de Confirmação */}
      <ConfirmModal
        visible={confirmDialog.visible}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ visible: false, message: '', actionId: null, onConfirm: () => {} })}
      />
      
      {/* Cabeçalho */}
      <header className="bg-white border-b border-slate-200 shadow-lg sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-3 rounded-full shadow-md flex-shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 leading-tight">Condomínio Residencial</h1>
              <span className="text-xs text-slate-500 font-medium tracking-wide uppercase mt-1 block">Cadastro de Moradores</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Online
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        
        {/* Formulário de Adição */}
        <section className="bg-white rounded-xl shadow-xl border border-blue-100 overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="text-blue-700" size={20} />
              <h2 className="font-bold text-lg text-blue-700">Adicionar Novo Morador</h2>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  required
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  placeholder="Ex: Maria da Silva"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 outline-none transition text-sm shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Bloco</label>
                <div className="relative">
                  <Home className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    required
                    type="text"
                    name="bloco"
                    value={formData.bloco}
                    onChange={handleChange}
                    placeholder="Ex: A"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-200 outline-none text-sm shadow-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Apartamento</label>
                <div className="relative">
                  <Home className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    required
                    type="text"
                    name="apartamento"
                    value={formData.apartamento}
                    onChange={handleChange}
                    placeholder="Ex: 101"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-200 outline-none text-sm shadow-sm"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3 rounded-xl font-semibold text-white text-base shadow-lg transition duration-300 ${
                submitting 
                  ? 'bg-slate-400 cursor-not-allowed shadow-none' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/50 hover:shadow-blue-500/70 focus:ring-4 focus:ring-blue-300'
              }`}
            >
              {submitting ? 'Registrando...' : 'Confirmar Cadastro'}
            </button>

            {/* Notificação no Formulário */}
            {notification.visible && (
              <div 
                className={`p-3 rounded-lg flex items-center justify-between border text-sm animate-in fade-in ${notificationClasses}`}
              >
                <div className="flex items-center gap-2">
                    {notificationIcon}
                    <span>{notification.message}</span>
                </div>
                <button onClick={() => setNotification(prev => ({ ...prev, visible: false }))} className="p-1 text-inherit hover:opacity-80">
                    <X size={16} />
                </button>
              </div>
            )}
          </form>
        </section>

        {/* Lista de Moradores */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-extrabold text-slate-600 uppercase tracking-widest flex items-center gap-2">
              Lista de Moradores Cadastrados
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-300 shadow-sm">
              Total: {residents.length}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Carregando dados...</div>
          ) : residents.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 shadow-md">
              <User className="mx-auto mb-2 text-slate-300" size={32} />
              <p className="text-sm">Nenhum morador encontrado. Adicione um novo morador acima.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {residents.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white p-5 rounded-xl shadow-lg border-l-4 border-blue-500 transition hover:shadow-xl relative"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-10">
                      <h4 className="font-bold text-slate-900 text-lg mb-1">{item.nome}</h4>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1 text-xs font-medium text-slate-500">
                        <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                          Bloco: {item.bloco}
                        </span>
                        <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                          Apartamento: {item.apartamento}
                        </span>
                      </div>
                    </div>
                    
                    {/* Botão de Excluir */}
                    <button 
                      onClick={() => initiateDelete(item.id, item.nome)}
                      className="text-slate-400 hover:text-red-600 transition p-2 rounded-full hover:bg-red-50 absolute top-3 right-3"
                      title="Remover Morador"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

