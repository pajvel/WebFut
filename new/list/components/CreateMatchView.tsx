
import React, { useState } from 'react';

interface CreateMatchViewProps {
  onClose: () => void;
  onCreate: (data: { date: string; venue: string }) => void;
}

const CreateMatchView: React.FC<CreateMatchViewProps> = ({ onClose, onCreate }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [venue, setVenue] = useState('EXPERT');

  const venues = ['EXPERT', 'MARACANA'];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      ></div>
      
      {/* Bottom Sheet Panel */}
      <div className="relative bg-white z-10 w-full max-h-[90vh] rounded-t-[2.5rem] border-t-4 border-black flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Handle bar for aesthetic */}
        <div className="w-full flex justify-center py-3">
          <div className="w-12 h-1.5 bg-black/10 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="flex-none px-6 pb-4 flex items-center justify-between">
          <h1 className="font-black italic text-2xl tracking-tight uppercase">CREATE MATCH</h1>
          <button 
            onClick={onClose}
            className="w-10 h-10 border-2 border-black rounded-full flex items-center justify-center brutalist-shadow-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="flex-1 p-6 space-y-8 overflow-y-auto">
          {/* Date Section */}
          <section>
            <label className="block font-black italic text-sm uppercase mb-3 tracking-tight text-gray-400">Select Date</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white border-2 border-black p-4 font-black text-lg rounded-2xl brutalist-shadow-sm outline-none focus:ring-4 focus:ring-black/5"
            />
          </section>

          {/* Venue Section */}
          <section>
            <label className="block font-black italic text-sm uppercase mb-3 tracking-tight text-gray-400">Select Venue</label>
            <div className="grid grid-cols-1 gap-4">
              {venues.map((v) => (
                <button
                  key={v}
                  onClick={() => setVenue(v)}
                  className={`w-full p-6 border-2 border-black rounded-[1.75rem] font-black italic text-2xl tracking-tighter uppercase transition-all flex items-center justify-between ${
                    venue === v ? 'bg-black text-white' : 'bg-white text-black brutalist-shadow hover:bg-gray-50'
                  }`}
                >
                  {v}
                  {venue === v && (
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Footer Button */}
        <div className="p-6 pb-10 border-t-2 border-black/5 bg-white">
          <button
            onClick={() => onCreate({ date, venue })}
            className="w-full bg-black text-white p-5 rounded-2xl font-black italic text-xl uppercase tracking-tight brutalist-shadow active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            Confirm & Create
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateMatchView;
