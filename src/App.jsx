import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged 
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot, // Importado para escutar mudanças em tempo real
} from "firebase/firestore";

// ------------------------------
// 🔥 CONFIG FIREBASE
// ------------------------------
let firebaseConfig;

if (typeof __firebase_config !== 'undefined' && __firebase_config) {
  try {
    firebaseConfig = JSON.parse(__firebase_config);
  } catch (e) {
    console.error("Erro ao fazer parse de __firebase_config:", e);
  }
}

if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.warn("Aviso: Usando fallback de configuração. As operações de banco de dados podem falhar se o ambiente não fornecer a configuração.");
  firebaseConfig = {
    apiKey: "YOUR_VITE_API_KEY", 
    authDomain: "YOUR_VITE_AUTH_DOMAIN",
    projectId: "YOUR_VITE_PROJECT_ID",
    storageBucket: "YOUR_VITE_STORAGE_BUCKET",
    messagingSenderId: "YOUR_VITE_MESSAGING_SENDER_ID",
    appId: "YOUR_VITE_APP_ID",
    measurementId: "YOUR_VITE_MEASUREMENT_ID",
  };
}

if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_")) {
    console.error("ERRO CRÍTICO: Configuração do Firebase parece ausente ou incompleta. As operações de banco de dados podem falhar.");
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // Instância de autenticação

// ------------------------------
// 🛠️ FUNÇÕES DE UTILIDADE
// ------------------------------

// Retorna a data e hora atual em formato YYYY-MM-DD e HH:MM
const getInitialDateTime = () => {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].substring(0, 5);
    return { date, time };
};

const { date: initialDate, time: initialTime } = getInitialDateTime();

// Formata a data para exibição (DD/MM/YYYY às HH:MM)
const formatDateTime = (isoString) => {
    if (!isoString) return "Data Inválida";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Data Inválida";
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} às ${hour}:${minute}`;
};

// Componente Modal de Confirmação (Substitui window.confirm)
const ConfirmationModal = ({ isOpen, onConfirm, onCancel, registro }) => {
    if (!isOpen || !registro) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-2xl max-w-sm w-full">
                <h3 className="text-xl font-bold text-red-600 mb-4">Confirmar Exclusão</h3>
                <p className="text-gray-700 mb-6">
                    Você tem certeza que deseja excluir o registro de:
                </p>
                <div className="bg-gray-100 p-3 rounded-md border border-gray-200 mb-6">
                    <p className="font-semibold text-blue-700">{registro.empresa}</p>
                    <p className="text-sm text-gray-500">{formatDateTime(registro.dataHora)}</p>
                </div>
                
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition duration-150"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition duration-150"
                    >
                        Excluir
                    </button>
                </div>
            </div>
        </div>
    );
};


// ------------------------------
// 🔥 APP PRINCIPAL
// ------------------------------
export default function App() {
  const [registros, setRegistros] = useState([]);
  const [empresa, setEmpresa] = useState("");
  const [data, setData] = useState(initialDate);
  const [horario, setHorario] = useState(initialTime);
  const [observacao, setObservacao] = useState("");
  const [message, setMessage] = useState(null);
  const [filtro, setFiltro] = useState(""); // Estado para o filtro de busca
  
  // Estados de Autenticação
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  // Estado do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [registroToDelete, setRegistroToDelete] = useState(null);
  
  // Função para limpar a mensagem após um tempo
  const clearMessage = () => {
    setTimeout(() => setMessage(null), 4000);
  };

  // ----------------------------------------------------
  // 🔑 1. EFEITO DE AUTENTICAÇÃO E CARREGAMENTO DO CSS
  // ----------------------------------------------------
  useEffect(() => {
    // ESTE BLOCO GARANTE QUE O TAILWIND CSS SEJA CARREGADO MESMO NO VERCEL/PRODUÇÃO
    // Ele injeta o script CDN do Tailwind no cabeçalho do documento (Header).
    const scriptId = 'tailwind-cdn-script';
    if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.src = "https://cdn.tailwindcss.com";
        script.id = scriptId;
        document.head.appendChild(script);
    }
    
    // Configuração de autenticação
    const handleAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Erro na autenticação Firebase:", error);
      }
    };

    handleAuth();

    // Monitora as mudanças no estado de autenticação
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
      setIsAuthReady(true); // A autenticação está pronta
    });

    return () => unsubscribe();
  }, []); // Executa apenas na montagem do componente

  // ----------------------------------------------------
  // 📚 2. CARREGAR DADOS EM TEMPO REAL (onSnapshot)
  // ----------------------------------------------------
  useEffect(() => {
    // Bloqueia se a autenticação não estiver pronta ou se não houver userId
    if (!isAuthReady || !userId) {
        console.warn("Autenticação não concluída. Pulando a escuta de dados.");
        return;
    }
    
    // Caminho da coleção seguindo as regras de segurança do Canvas (dados privados)
    const collectionPath = `artifacts/${appId}/users/${userId}/registros_portaria`;
    const registrosCollection = collection(db, collectionPath);
    
    // Configura a escuta em tempo real
    const unsubscribe = onSnapshot(registrosCollection, (querySnapshot) => {
        try {
            const lista = [];
            querySnapshot.forEach((docu) => {
              lista.push({ id: docu.id, ...docu.data() });
            });
            
            // Ordenação local: mais recente primeiro
            lista.sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
    
            setRegistros(lista);
            setMessage(null); // Limpa qualquer mensagem de erro anterior
        } catch (error) {
            console.error("Erro ao receber atualização de dados (onSnapshot):", error);
            setMessage({ text: "Erro ao atualizar histórico. Verifique a conexão.", type: "error" });
            // Deixamos a mensagem de erro visível para o usuário diagnosticar
            // clearMessage(); 
        }
    }, (error) => {
        // Callback de erro do listener
        console.error("Erro no listener onSnapshot:", error);
        setMessage({ text: "Falha na conexão em tempo real. Erro de permissão.", type: "error" });
        // Deixamos a mensagem de erro visível para o usuário diagnosticar
        // clearMessage(); 
    });

    // Função de limpeza: interrompe a escuta quando o componente é desmontado
    return () => unsubscribe();
  }, [isAuthReady, userId]); // Depende do estado de autenticação e do ID do usuário

  // ----------------------------------------------------
  // 3. LÓGICA DE FILTRAGEM
  // ----------------------------------------------------
  const registrosFiltrados = registros.filter(item => {
    const termo = filtro.toLowerCase();
    const empresaLower = item.empresa ? item.empresa.toLowerCase() : '';
    const observacaoLower = item.observacao ? item.observacao.toLowerCase() : '';
    const dataHoraLower = item.dataHora ? formatDateTime(item.dataHora).toLowerCase() : '';

    return empresaLower.includes(termo) || 
           observacaoLower.includes(termo) ||
           dataHoraLower.includes(termo);
  });


  // ----------------------------------------------------
  // ➕ 4. ADICIONAR REGISTRO
  // ----------------------------------------------------
  const handleAdd = async () => {
    if (!isAuthReady || !userId) {
        setMessage({ text: "Aguarde a autenticação para registrar.", type: "error" }); 
        // Deixamos a mensagem de erro visível
        return;
    }
    
    if (!empresa || !data || !horario) {
      setMessage({ text: "Empresa, Data e Horário são obrigatórios!", type: "error" }); 
      clearMessage();
      return;
    }

    const collectionPath = `artifacts/${appId}/users/${userId}/registros_portaria`;

    try {
        // Combina data e horário para um único ISO string (Timestamp)
        const dataHoraRegistro = new Date(`${data}T${horario}:00`).toISOString();
        
        await addDoc(collection(db, collectionPath), {
          empresa: empresa,
          dataHora: dataHoraRegistro,
          observacao: observacao || "Sem observação",
        });

        // Os campos são limpos APENAS após o sucesso do addDoc.
        // Se eles não limparam, é porque o addDoc falhou.
        setEmpresa("");
        setObservacao("");
        
        // Define nova data/hora inicial
        const newInitial = getInitialDateTime();
        setData(newInitial.date);
        setHorario(newInitial.time);
        
        // O onSnapshot cuidará de recarregar a lista
        setMessage({ text: "Registro salvo com sucesso!", type: "success" });
        clearMessage();
    } catch (error) {
        console.error("Erro ao adicionar registro:", error);
        // Deixamos a mensagem de erro visível para o usuário
        setMessage({ text: "Erro ao confirmar registro. Verifique as permissões de gravação.", type: "error" });
        // clearMessage() removido daqui para que a mensagem de erro persista
    }
  };

  // ----------------------------------------------------
  // 🗑️ 5. EXCLUIR REGISTRO 
  // ----------------------------------------------------
  // 1. Abre o modal de confirmação
  const openDeleteModal = (id) => {
      if (!isAuthReady || !userId) {
        setMessage({ text: "Aguarde a autenticação para excluir.", type: "error" }); 
        clearMessage();
        return;
      }
      const registro = registros.find(r => r.id === id);
      if (registro) {
          setRegistroToDelete(registro);
          setIsModalOpen(true);
      }
  };

  // 2. Confirma a exclusão e executa a operação
  const confirmDelete = async () => {
    if (!registroToDelete || !userId) return;

    setIsModalOpen(false); // Fecha o modal
    
    const docPath = `artifacts/${appId}/users/${userId}/registros_portaria/${registroToDelete.id}`;

    try {
        await deleteDoc(doc(db, docPath));
        setRegistroToDelete(null);
        
        // O onSnapshot cuidará de recarregar a lista
        setMessage({ text: "Registro excluído com sucesso!", type: "success" });
        clearMessage();
    } catch (error) {
        console.error("Erro ao excluir:", error);
        setMessage({ text: "Erro ao excluir registro. Tente novamente.", type: "error" });
        clearMessage();
    }
  };

  // 3. Cancela a exclusão
  const cancelDelete = () => {
      setIsModalOpen(false);
      setRegistroToDelete(null);
  };


  // ------------------------------
  // 🎨 LAYOUT
  // ------------------------------
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      
      {/* Modal de Confirmação */}
      <ConfirmationModal 
          isOpen={isModalOpen} 
          onConfirm={confirmDelete} 
          onCancel={cancelDelete} 
          registro={registroToDelete} 
      />
      
      {/* Cabeçalho */}
      <header className="bg-blue-800 text-white shadow-xl mb-8">
        {/* Aumentado de max-w-5xl para max-w-7xl */}
        <div className="max-w-7xl mx-auto p-6 text-center"> 
            <h1 className="text-3xl font-bold">
              Condomínio Gilles Deleuze
            </h1>
            <p className="text-sm font-normal opacity-80 mt-1">
              Portaria - Sistema de Registro
            </p>
        </div>
      </header>

      {/* Container principal com largura maior */}
      {/* Aumentado de max-w-5xl para max-w-7xl */}
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Mensagens de feedback */}
        {message && (
          <div className={`p-4 mb-6 rounded-lg font-medium text-center ${
            message.type === 'error' 
              ? 'bg-red-100 text-red-700 border border-red-300' 
              : 'bg-green-100 text-green-700 border border-green-300'
          }`}>
            {message.text}
          </div>
        )}

        {/* Indicador de Autenticação/Carregamento */}
        {!isAuthReady && (
            <div className="p-4 mb-6 rounded-lg font-medium text-center bg-yellow-100 text-yellow-700 border border-yellow-300">
                Aguardando autenticação e carregamento de dados...
            </div>
        )}
        
        {/* Formulário de Novo Registro */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">
            Novo Registro
          </h2>

          <div className="space-y-4">
            {/* Campo Empresa / Prestador */}
            <label className="block text-gray-700 font-medium">Empresa / Prestador</label>
            <input
              type="text"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              // Campo de entrada agora habilitado imediatamente
            />
            
            {/* Campo Data e Horário (lado a lado) */}
            <div className="flex space-x-4">
              <div className="w-1/2">
                <label className="block text-gray-700 font-medium">Data</label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                  // Campo de entrada agora habilitado imediatamente
                />
              </div>
              <div className="w-1/2">
                <label className="block text-gray-700 font-medium">Horário</label>
                <input
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                  // Campo de entrada agora habilitado imediatamente
                />
              </div>
            </div>

            {/* Campo Observação */}
            <label className="block text-gray-700 font-medium">Observação</label>
            <textarea
              placeholder="Detalhes adicionais ou notas..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows="3"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 resize-none"
              // Campo de entrada agora habilitado imediatamente
            ></textarea>

            {/* Botão Confirmar Registro (Desabilitado se não houver autenticação) */}
            <button
              onClick={handleAdd}
              className={`w-full font-bold py-3 rounded-md transition duration-200 shadow-md mt-4 ${
                  !isAuthReady || !userId 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              disabled={!isAuthReady || !userId} // MANTÉM ESSA CHECAGEM AQUI!
            >
              Confirmar Registro
            </button>
          </div>
        </div>

        {/* Histórico de Entradas */}
        <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
          HISTÓRICO DE ENTRADAS
        </h2>
        
        {/* Campo de Filtro de Busca */}
        <div className="mb-4">
            <input
                type="text"
                placeholder="Filtrar por nome, observação ou data..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150"
            />
        </div>

        {/* Total de Registros (Filtrados) */}
        <p className="text-right text-sm text-gray-500 mb-4">
            Mostrando: {registrosFiltrados.length} de {registros.length} registros
        </p>

        <ul className="space-y-3">
          {
            !isAuthReady || !userId ? (
              <li className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center text-gray-700 shadow-sm">
                Conectando ao banco de dados...
              </li>
            ) : registrosFiltrados.length === 0 ? (
              <li className="p-4 bg-white border border-gray-200 rounded-lg text-center text-gray-500 shadow-sm">
                {filtro ? "Nenhum registro corresponde ao filtro." : "Nenhum registro encontrado."}
              </li>
            ) : (
              registrosFiltrados.map((item) => (
                <li 
                  key={item.id} 
                  className="flex justify-between items-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
                >
                  <div className="text-gray-700 flex-grow pr-4">
                    <span className="font-bold text-lg text-blue-700 block">
                      {item.empresa}
                    </span>
                    <span className="text-sm text-gray-600 mt-1 block">
                      {formatDateTime(item.dataHora)}
                    </span>
                    <span className={`text-xs mt-1 block ${item.observacao === "Sem observação" ? 'text-gray-400 italic' : 'text-gray-500'}`}>
                      {item.observacao}
                    </span>
                  </div>

                  {/* Ícone de Lixo (Deletar) - Abre o modal */}
                  <button
                    onClick={() => openDeleteModal(item.id)}
                    className="text-gray-400 hover:text-red-600 transition duration-200 p-2 rounded-full"
                    title="Excluir Registro"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 10-2 0v6a1 1 0 102 0V8z" clipRule="evenodd" />
                    </svg>
                  </button>
                </li>
              ))
            )
          }
        </ul>
      </div>
      
      {/* Exibir o ID do Usuário na parte inferior (Requisito de App Colaborativo) */}
      <footer className="max-w-7xl mx-auto px-4 mt-8 pt-4 border-t text-sm text-gray-500 text-center">
        {userId && (
            <p>Seu ID de Usuário (Necessário para Colaboração): <span className="font-mono text-gray-700 break-all">{userId}</span></p>
        )}
      </footer>
    </div>
  );
}