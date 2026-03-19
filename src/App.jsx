import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

function App() {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState({
    unidade: "Carregando...",
    email: "",
    cargo: "tecnico",
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [aba, setAba] = useState("tecnico");
  const [editandoId, setEditandoId] = useState(null);
  const [busca, setBusca] = useState("");
  const [listaOS, setListaOS] = useState([]);
  const [mesFiltro, setMesFiltro] = useState(
    new Date().toISOString().substring(0, 7),
  );

  const [form, setForm] = useState({
    descricao: "",
    sistema: "",
    tipo_atividade: "",
    status: "",
    data_inicio: "",
    data_fim: "",
    codigo_os: "",
  });

  const eMailMaster = "master@compasss.com.br";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) carregarPerfil(session.user.id);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) carregarPerfil(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function carregarPerfil(userId) {
    const { data } = await supabase
      .from("perfis")
      .select("unidade, email, cargo")
      .eq("id", userId)
      .single();
    if (data) {
      setPerfil(data);
      if (data.cargo === "gerente") setAba("admin");
    }
  }

  useEffect(() => {
    if (session && perfil.unidade !== "Carregando...") buscarOS();
  }, [aba, session, perfil]);

  useEffect(() => {
    if (aba === "tecnico" && !editandoId) {
      limparForm();
    }
  }, [aba]);

  async function buscarOS() {
    let query = supabase
      .from("ordens_servico")
      .select("*")
      .order("created_at", { ascending: false });
    if (session.user.email !== eMailMaster) {
      query = query.eq("unidade", perfil.unidade);
    }
    const { data } = await query;
    setListaOS(data || []);
  }

  const osFiltradas = listaOS.filter((os) => {
    const matchesBusca =
      os.criado_por?.toLowerCase().includes(busca.toLowerCase()) ||
      os.codigo_os?.toLowerCase().includes(busca.toLowerCase());
    const noMes =
      os.data_inicio?.startsWith(mesFiltro) ||
      (os.data_fim && os.data_fim.startsWith(mesFiltro));
    return matchesBusca && noMes;
  });

  // RESTAURADO: Exportação para BI
  const exportarCSV = () => {
    if (osFiltradas.length === 0)
      return alert("Nenhum registro para exportar.");
    const headers = [
      "Codigo OS",
      "Sistema",
      "Atividade",
      "Status",
      "Inicio",
      "Fim",
      "Tecnico",
      "Unidade",
      "Descricao",
    ];
    const rows = osFiltradas.map((os) => [
      os.codigo_os,
      os.sistema,
      os.tipo_atividade,
      os.status,
      os.data_inicio,
      os.data_fim || "",
      os.criado_por,
      os.unidade,
      os.descricao.replace(/\n/g, " "),
    ]);
    const csvContent = [headers, ...rows].map((e) => e.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Relatorio_OS_${mesFiltro}.csv`;
    link.click();
  };

  // RESTAURADO: Função de Exclusão
  async function excluirOS(id) {
    if (confirm("Deseja realmente apagar este registro permanentemente?")) {
      const { error } = await supabase
        .from("ordens_servico")
        .delete()
        .eq("id", id);
      if (error) alert("Erro ao excluir: " + error.message);
      else buscarOS();
    }
  }

  async function salvarOS(e) {
    e.preventDefault();
    const prefixo =
      `${form.sistema.substring(0, 3)}${form.tipo_atividade.substring(0, 2)}`.toUpperCase();
    const novoCodigo = `${prefixo}${Math.floor(1000 + Math.random() * 9000)}`;

    const dadosParaEnviar = {
      descricao: form.descricao,
      sistema: form.sistema,
      tipo_atividade: form.tipo_atividade,
      status: form.status,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      unidade: perfil.unidade,
      criado_por: session.user.email,
      user_id: session.user.id,
      codigo_os: editandoId ? form.codigo_os : novoCodigo,
    };

    if (editandoId) {
      const { error } = await supabase
        .from("ordens_servico")
        .update(dadosParaEnviar)
        .eq("id", editandoId);
      if (error) alert("Erro ao atualizar!");
      else {
        alert("Dados Sincronizados!");
        limparForm();
        setAba("admin");
        buscarOS();
      }
    } else {
      const { error } = await supabase
        .from("ordens_servico")
        .insert([dadosParaEnviar]);
      if (error) alert("Erro ao gravar: " + error.message);
      else {
        alert("OS Registrada!");
        limparForm();
        buscarOS();
      }
    }
  }

  const limparForm = () => {
    setForm({
      descricao: "",
      sistema: "",
      tipo_atividade: "",
      status: "",
      data_inicio: "",
      data_fim: "",
      codigo_os: "",
    });
    setEditandoId(null);
  };

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) alert("Erro: " + error.message);
    setLoading(false);
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#040404] p-6">
        <form
          onSubmit={handleLogin}
          className="bg-[#1a1a1a] p-10 rounded-[40px] border border-[#84c464]/20 w-full max-w-sm shadow-2xl"
        >
          <input style={{ display: "none" }} type="text" name="fake_user" />
          <input
            style={{ display: "none" }}
            type="password"
            name="fake_password"
          />
          <div className="flex justify-center mb-8">
            <img
              src="/compasss.png"
              alt="Logo"
              className="w-24 h-24 object-contain"
            />
          </div>
          <h2 className="text-xl font-black mb-8 text-center text-[#84c464] uppercase italic tracking-widest">
            Painel de Acesso
          </h2>
          <input
            type="email"
            name={`u_${Math.random()}`}
            placeholder="E-mail"
            autoComplete="new-password"
            className="w-full bg-[#262626] border-2 border-transparent focus:border-[#84c464] p-4 rounded-2xl mb-4 font-bold text-white outline-none transition-all"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            name={`p_${Math.random()}`}
            placeholder="Senha"
            autoComplete="new-password"
            className="w-full bg-[#262626] border-2 border-transparent focus:border-[#84c464] p-4 rounded-2xl mb-8 font-bold text-white outline-none transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="w-full bg-[#84c464] text-[#040404] p-5 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition">
            {loading ? "PROCESSANDO..." : "INICIAR SESSÃO"}
          </button>
        </form>
      </div>
    );
  }
  async function handleLogout() {
    try {
      // 1. Avisa o Supabase para encerrar a sessão
      await supabase.auth.signOut();

      // 2. Limpa todos os vestígios locais
      localStorage.clear();
      sessionStorage.clear();

      // 3. Reseta os estados do React
      setSession(null);
      setEmail("");
      setPassword("");

      // 4. Força o recarregamento para limpar a memória do navegador
      window.location.href = "/";
    } catch (error) {
      console.error("Erro ao deslogar:", error);
      // Se falhar, pelo menos forçamos o reload
      window.location.reload();
    }
  }

  return (
    <div className="min-h-screen bg-[#040404] pb-20 text-[#848484]">
      <div className="bg-[#0c0c0c] border-b border-[#84c464]/10 sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <img
            src="/compasss.png"
            className="w-8 h-8 object-contain"
            alt="mini-logo"
          />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-[#84c464] uppercase">
              {perfil.unidade}
            </span>
            <span className="text-[9px] text-[#7c7c7c] font-bold">
              {session.user.email}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-[9px] font-black text-[#84c464] border border-[#84c464]/30 px-4 py-2 rounded-full uppercase hover:bg-[#84c464] hover:text-[#040404] transition-all"
        >
          Sair
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex bg-[#1a1a1a] p-1.5 rounded-2xl border border-[#84c464]/10 mb-8">
          {perfil.cargo !== "gerente" && (
            <button
              onClick={() => setAba("tecnico")}
              className={`flex-1 py-4 rounded-xl font-black text-[10px] tracking-widest transition-all ${aba === "tecnico" ? "bg-[#84c464] text-[#040404] shadow-lg" : "text-[#7c7c7c]"}`}
            >
              REGISTRO
            </button>
          )}
          <button
            onClick={() => setAba("admin")}
            className={`flex-1 py-4 rounded-xl font-black text-[10px] tracking-widest transition-all ${aba === "admin" ? "bg-[#84c464] text-[#040404] shadow-lg" : "text-[#7c7c7c]"}`}
          >
            HISTÓRICO
          </button>
        </div>

        {aba === "tecnico" ? (
          <form onSubmit={salvarOS} className="space-y-4" autoComplete="off">
            <div className="bg-[#1a1a1a] p-6 rounded-[32px] border border-[#84c464]/10 space-y-5">
              <h2 className="font-black italic uppercase text-[#84c464] text-xs tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-[#84c464] rounded-full animate-pulse"></span>
                {editandoId ? "Modo Edição" : "Lançar Atividade"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  className="w-full bg-[#262626] border border-transparent focus:border-[#84c464] p-4 rounded-2xl font-bold text-white outline-none"
                  value={form.sistema}
                  onChange={(e) =>
                    setForm({ ...form, sistema: e.target.value })
                  }
                  required
                >
                  <option value="">Sistema...</option>
                  {["Telecom", "SCA", "SAI", "SDAI", "BMS"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full bg-[#262626] border border-transparent focus:border-[#84c464] p-4 rounded-2xl font-bold text-white outline-none"
                  value={form.tipo_atividade}
                  onChange={(e) =>
                    setForm({ ...form, tipo_atividade: e.target.value })
                  }
                  required
                >
                  <option value="">Atividade...</option>
                  {[
                    "Acompanhamento",
                    "Outros",
                    "Manutenção Corretiva",
                    "Manutenção Preventiva",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4 text-white">
                <input
                  type="date"
                  className="bg-[#262626] p-4 rounded-2xl text-xs font-bold border-none outline-none"
                  value={form.data_inicio}
                  onChange={(e) =>
                    setForm({ ...form, data_inicio: e.target.value })
                  }
                  required
                />
                <input
                  type="date"
                  className="bg-[#262626] p-4 rounded-2xl text-xs font-bold border-none outline-none"
                  value={form.data_fim || ""}
                  onChange={(e) =>
                    setForm({ ...form, data_fim: e.target.value })
                  }
                />
              </div>
              <select
                className="w-full bg-[#262626] border border-transparent focus:border-[#84c464] p-4 rounded-2xl font-bold text-white outline-none"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                required
              >
                <option value="">Status...</option>
                {["À fazer", "Em andamento", "Concluído"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <textarea
                className="w-full bg-[#262626] border border-transparent focus:border-[#84c464] p-5 rounded-[24px] h-32 outline-none font-medium text-sm text-white"
                placeholder="Descrição técnica..."
                value={form.descricao}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                required
              />
              <div className="flex gap-2">
                <button
                  className={`flex-[2] p-5 rounded-2xl font-black text-[#040404] shadow-xl ${editandoId ? "bg-orange-500" : "bg-[#84c464]"}`}
                >
                  {editandoId ? "ATUALIZAR" : "GERAR OS"}
                </button>
                {editandoId && (
                  <button
                    type="button"
                    onClick={limparForm}
                    className="flex-1 bg-white/10 text-white p-5 rounded-2xl font-black text-[10px]"
                  >
                    CANCELAR
                  </button>
                )}
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#1a1a1a] p-6 rounded-[32px] border border-[#84c464]/10 space-y-4 shadow-xl">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-[10px] font-black text-[#84c464] uppercase tracking-widest italic">
                  Painel BI
                </h3>
                <button
                  onClick={exportarCSV}
                  className="bg-[#84c464]/10 text-[#84c464] text-[9px] font-black px-4 py-2 rounded-full border border-[#84c464]/30 hover:bg-[#84c464] hover:text-[#040404]"
                >
                  EXCEL EXPORT
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="month"
                  className="flex-1 bg-[#262626] text-white p-3 rounded-xl text-xs font-bold border-none"
                  value={mesFiltro}
                  onChange={(e) => setMesFiltro(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="flex-[2] bg-[#262626] text-white p-3 rounded-xl text-xs font-bold border-none"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              {osFiltradas.map((os) => (
                <div
                  key={os.id}
                  className="bg-[#1a1a1a] p-6 rounded-[28px] border border-[#84c464]/5 relative hover:border-[#84c464]/30 transition-all shadow-lg"
                >
                  <div
                    className={`absolute top-0 left-0 w-1 h-full ${os.status === "Concluído" ? "bg-[#84c464]" : "bg-orange-500"}`}
                  ></div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-mono font-black text-[#84c464] text-sm italic">
                      {os.codigo_os}
                    </span>
                    <span
                      className={`text-[8px] font-black px-3 py-1 rounded-full uppercase border ${os.status === "Concluído" ? "border-[#84c464] text-[#84c464]" : "border-orange-500 text-orange-500"}`}
                    >
                      {os.status}
                    </span>
                  </div>
                  <h3 className="font-black text-white text-[11px] uppercase tracking-wide">
                    {os.sistema} |{" "}
                    <span className="text-[#7c7c7c]">{os.tipo_atividade}</span>
                  </h3>
                  <p className="text-[11px] text-[#848484] my-4 leading-relaxed line-clamp-3">
                    {os.descricao}
                  </p>
                  <div className="flex justify-between items-center border-t border-[#84c464]/5 pt-4">
                    <span className="text-[10px] font-black text-[#84c464] italic">
                      {os.criado_por?.split("@")[0]}
                    </span>
                    <div className="flex gap-2">
                      {os.criado_por === session.user.email && (
                        <button
                          onClick={() => {
                            setEditandoId(os.id);
                            setForm({
                              ...os,
                              data_inicio: os.data_inicio?.split("T")[0],
                              data_fim: os.data_fim?.split("T")[0],
                            });
                            setAba("tecnico");
                          }}
                          className="bg-[#84c464]/5 text-[#84c464] p-2 px-4 rounded-xl font-black text-[9px] border border-[#84c464]/20"
                        >
                          EDIT
                        </button>
                      )}
                      {(os.criado_por === session.user.email ||
                        session.user.email === eMailMaster) && (
                        <button
                          onClick={() => excluirOS(os.id)}
                          className="bg-red-500/5 text-red-500 p-2 px-4 rounded-xl font-black text-[9px] border border-red-500/20"
                        >
                          DEL
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default App;
