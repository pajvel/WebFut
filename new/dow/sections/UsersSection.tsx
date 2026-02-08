
import React, { useState, useMemo } from 'react';
import { Player, TgProfile } from '../types';
import { mockPlayers, mockTgProfiles } from '../data/mockData';
import { SectionHeader, ActionButton, Input, Badge } from '../components/Shared';

const UsersSection: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>(mockPlayers);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSelectingTg, setIsSelectingTg] = useState(false);
  const [isSelectingInviter, setIsSelectingInviter] = useState(false);
  const [tgSearch, setTgSearch] = useState('');
  const [inviterSearch, setInviterSearch] = useState('');
  
  const [sortField, setSortField] = useState<keyof Player>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Form states
  const [formName, setFormName] = useState('');
  const [formTgId, setFormTgId] = useState('');
  const [formInitialRating, setFormInitialRating] = useState(500);
  const [formAttack, setFormAttack] = useState(0);
  const [formDefense, setFormDefense] = useState(0);
  const [formInvitedBy, setFormInvitedBy] = useState<string | undefined>(undefined);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      
      const strA = (valA ?? '').toString().toLowerCase();
      const strB = (valB ?? '').toString().toLowerCase();
      
      if (strA < strB) return sortDir === 'asc' ? -1 : 1;
      if (strA > strB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [players, sortField, sortDir]);

  const openCreateModal = () => {
    setEditingPlayer(null);
    setIsCreating(true);
    setFormName('');
    setFormTgId('');
    setFormInitialRating(500);
    setFormAttack(0);
    setFormDefense(0);
    setFormInvitedBy(undefined);
  };

  const openEditModal = (player: Player) => {
    setEditingPlayer(player);
    setIsCreating(false);
    setFormName(player.name);
    setFormTgId(player.tg_id);
    setFormInitialRating(player.initialGlobalRating ?? player.globalRating);
    setFormAttack(player.attackRating);
    setFormDefense(player.defenseRating);
    setFormInvitedBy(player.invitedBy);
  };

  const closeModal = () => {
    setEditingPlayer(null);
    setIsCreating(false);
  };

  const getPlayerName = (id?: string) => players.find(p => p.id === id)?.name || 'НЕТ';

  const toggleSort = (field: keyof Player) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const formatSpecialization = (p: Player) => {
    if (p.attackRating === 0 && p.defenseRating === 0) {
      return <span className="text-zinc-600 font-black italic tracking-tighter text-[10px]">СРЕДНИЙ</span>;
    }
    
    return (
      <div className="flex flex-col leading-tight">
        {p.attackRating > 0 && (
          <div className="flex items-center gap-1 justify-center">
            <span className="text-zinc-500 font-black text-[8px]">АТАКА</span>
            <span className="text-white font-mono text-[11px] font-black">{p.attackRating.toFixed(2)}</span>
          </div>
        )}
        {p.defenseRating > 0 && (
          <div className="flex items-center gap-1 justify-center">
            <span className="text-zinc-500 font-black text-[8px]">ЗАЩИТА</span>
            <span className="text-white font-mono text-[11px] font-black">{p.defenseRating.toFixed(2)}</span>
          </div>
        )}
      </div>
    );
  };

  const SortButton: React.FC<{ field: keyof Player; label: string }> = ({ field, label }) => {
    const isActive = sortField === field;
    return (
      <button 
        onClick={() => toggleSort(field)}
        className={`px-3 py-1.5 text-[10px] text-900 uppercase italic tracking-tighter border transition-all flex items-center gap-1 ${
          isActive 
            ? 'bg-webfut-pink border-webfut-pink text-black' 
            : 'border-webfut-border text-zinc-500 hover:text-white hover:border-zinc-500'
        }`}
      >
        {label}
        {isActive && (
          <span className="text-[8px] font-black">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="mb-6 lg:mb-8 bg-black lg:bg-transparent z-30 pt-1">
        <div className="flex flex-col gap-4 mb-6 border-b border-webfut-border pb-4">
          <div className="flex justify-between items-end">
            <h1 className="text-4xl text-900 uppercase tracking-tighter italic leading-none">ПОЛЬЗОВАТЕЛИ</h1>
            <button 
              onClick={openCreateModal}
              className="bg-webfut-pink text-black px-4 lg:px-6 py-2 text-[11px] lg:text-[14px] text-900 uppercase italic tracking-tighter hover:bg-white transition-colors border-2 border-transparent hover:border-black"
            >
              + ДОБАВИТЬ
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-900 uppercase text-zinc-500 mr-1">СОРТИРОВКА:</span>
            <SortButton field="name" label="ИМЯ" />
            <SortButton field="globalRating" label="GLB" />
            <SortButton field="attackRating" label="ATK" />
            <SortButton field="defenseRating" label="DEF" />
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="hidden lg:block bg-black border border-webfut-border overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-webfut-gray text-zinc-500 text-[10px] text-900 uppercase z-20">
              <tr>
                <th className="p-4 border-b border-webfut-border w-16 text-center">AVA</th>
                <th className="p-4 border-b border-webfut-border">ИМЯ</th>
                <th className="p-4 border-b border-webfut-border">TG_ID</th>
                <th className="p-4 border-b border-webfut-border text-center">СПЕЦ.</th>
                <th className="p-4 border-b border-webfut-border text-center text-zinc-400">EXP</th>
                <th className="p-4 border-b border-webfut-border text-center text-zinc-400">MAR</th>
                <th className="p-4 border-b border-webfut-border text-center text-webfut-pink">GLB</th>
                <th className="p-4 border-b border-webfut-border text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="text-400">
              {sortedPlayers.map(p => (
                <tr key={p.id} className="hover:bg-zinc-900 transition-colors group">
                  <td className="p-4 border-b border-webfut-border flex justify-center">
                    <img src={p.avatar} className="w-8 h-8 rounded-sm grayscale group-hover:grayscale-0 transition-all" alt="" />
                  </td>
                  <td className="p-4 border-b border-webfut-border text-900 uppercase italic text-lg tracking-tight">{p.name}</td>
                  <td className="p-4 border-b border-webfut-border font-mono text-zinc-500 text-xs">{p.tg_id}</td>
                  <td className="p-4 border-b border-webfut-border text-center">
                    {formatSpecialization(p)}
                  </td>
                  <td className="p-4 border-b border-webfut-border text-center font-mono text-xs text-zinc-600">{p.expertRating}</td>
                  <td className="p-4 border-b border-webfut-border text-center font-mono text-xs text-zinc-600">{p.marakanaRating}</td>
                  <td className="p-4 border-b border-webfut-border text-center text-webfut-pink text-900 text-xl italic">{p.globalRating}</td>
                  <td className="p-4 border-b border-webfut-border text-right">
                    <ActionButton variant="outline" onClick={() => openEditModal(p)} className="py-1 px-3 text-[10px] border-zinc-700 hover:border-white">ПРАВКА</ActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden space-y-4 pb-32">
          {sortedPlayers.map(p => (
            <div key={p.id} className="bg-webfut-gray border border-webfut-border p-4">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <img src={p.avatar} className="w-12 h-12 rounded-sm grayscale" alt="" />
                  <div className="min-w-0">
                    <h3 className="text-900 uppercase italic text-xl leading-none truncate">{p.name}</h3>
                    <div className="mt-2">
                      {p.attackRating === 0 && p.defenseRating === 0 ? (
                        <span className="text-zinc-600 font-black text-[9px] uppercase italic">СПЕЦ: СРЕДНИЙ</span>
                      ) : (
                        <div className="flex gap-3">
                          {p.attackRating > 0 && <span className="text-zinc-400 font-black text-[9px] uppercase italic">ATK: <span className="text-white">{p.attackRating.toFixed(2)}</span></span>}
                          {p.defenseRating > 0 && <span className="text-zinc-400 font-black text-[9px] uppercase italic">DEF: <span className="text-white">{p.defenseRating.toFixed(2)}</span></span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-webfut-pink text-3xl text-900 italic leading-none">{p.globalRating}</div>
              </div>
              <ActionButton variant="primary" onClick={() => openEditModal(p)} className="w-full py-3 text-xs font-black">РЕДАКТИРОВАТЬ</ActionButton>
            </div>
          ))}
        </div>
      </div>

      {(editingPlayer || isCreating) && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4">
          <div className="bg-webfut-dark border-4 border-white w-full max-w-lg p-8 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-3xl text-900 uppercase italic mb-8 border-b-4 border-webfut-pink pb-3">
              {isCreating ? 'НОВЫЙ ИГРОК' : `ПРАВКА: ${editingPlayer?.name}`}
            </h2>
            
            <div className="space-y-6">
              <Input label="ИМЯ В СИСТЕМЕ" value={formName} onChange={e => setFormName(e.target.value)} />
              <Input label="TELEGRAM ID" value={formTgId} onChange={e => setFormTgId(e.target.value)} />

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="АТАКА (0.00 = MID)" 
                  type="number" 
                  step="0.01" 
                  value={formAttack} 
                  onChange={e => setFormAttack(Number(e.target.value))} 
                />
                <Input 
                  label="ЗАЩИТА (0.00 = MID)" 
                  type="number" 
                  step="0.01" 
                  value={formDefense} 
                  onChange={e => setFormDefense(Number(e.target.value))} 
                />
              </div>

              <div className="pt-6 border-t-2 border-webfut-border">
                <label className="block text-zinc-500 text-[10px] font-black uppercase mb-2 tracking-widest">БАЙТОВЫЙ РЕЙТИНГ (GLOBAL)</label>
                <Input 
                  value={formInitialRating} 
                  onChange={e => setFormInitialRating(Number(e.target.value))} 
                  type="number" 
                  className="!text-webfut-pink !text-6xl !font-black bg-black h-24 text-center border-2 border-webfut-pink !mb-0" 
                />
              </div>
            </div>

            <div className="mt-10 flex gap-4">
              <ActionButton variant="ghost" onClick={closeModal} className="flex-1 py-4 text-xs border-2">ОТМЕНА</ActionButton>
              <ActionButton onClick={closeModal} className="flex-1 py-4 text-xs">СОХРАНИТЬ</ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersSection;
