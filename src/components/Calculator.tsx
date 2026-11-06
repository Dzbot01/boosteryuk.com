import { useState } from 'react';
import { Calculator as CalcIcon, X } from 'lucide-react';

/**
 * Floating calculator — a small vertical "kalkulator" tab hidden on the left
 * edge. Pulling it out reveals a white calculator card with expression display.
 */
export default function Calculator() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);

  const input = (digit: string) => {
    let nextDisplay = display;
    if (fresh) {
      nextDisplay = digit === '.' ? '0.' : digit;
      setDisplay(nextDisplay);
      setFresh(false);
    } else {
      if (digit === '.' && display.includes('.')) return;
      nextDisplay = display + digit;
      setDisplay(nextDisplay);
    }

    if (expression.includes('=')) {
      setExpression('');
    }
  };

  const clear = () => {
    setDisplay('0');
    setExpression('');
    setPrev(null);
    setOp(null);
    setFresh(true);
  };

  const backspace = () => {
    if (fresh) return;
    const next = display.slice(0, -1);
    const result = next === '' || next === '-' ? '0' : next;
    setDisplay(result);
    if (result === '0') setFresh(true);
  };

  const applyOp = (nextOp: string) => {
    const current = parseFloat(display);

    if (prev === null) {
      setPrev(current);
      setOp(nextOp);
      setExpression(`${current} ${nextOp}`);
    } else if (op && !fresh) {
      const result = compute(prev, current, op);
      setPrev(result);
      setDisplay(String(result));
      setOp(nextOp);
      setExpression(`${result} ${nextOp}`);
    } else {
      setOp(nextOp);
      setExpression(`${prev} ${nextOp}`);
    }
    setFresh(true);
  };

  const equals = () => {
    if (op === null || prev === null) return;
    const current = parseFloat(display);
    const result = compute(prev, current, op);
    setExpression(`${prev} ${op} ${current} =`);
    setDisplay(String(result));
    setPrev(null);
    setOp(null);
    setFresh(true);
  };

  const compute = (a: number, b: number, operator: string): number => {
    let res = 0;
    switch (operator) {
      case '+':
        res = a + b;
        break;
      case '-':
        res = a - b;
        break;
      case '×':
      case '*':
        res = a * b;
        break;
      case '÷':
      case '/':
        res = b === 0 ? 0 : a / b;
        break;
      default:
        res = b;
    }
    // Round to avoid floating point imprecision like 0.1 + 0.2 = 0.30000000000000004
    return Math.round(res * 100000000) / 100000000;
  };

  const btn =
    'h-11 rounded-xl text-[16px] font-semibold transition-transform active:scale-95';

  return (
    <>
      {/* Hidden pull-tab on the left edge */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Buka kalkulator"
        className={`fixed left-0 top-1/2 z-40 -translate-y-1/2 rounded-r-xl border border-l-0 border-slate-200 bg-white py-3 pl-2 pr-1.5 text-slate-600 shadow-md transition-all duration-300 hover:text-cyan-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${
          open ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        style={{ writingMode: 'vertical-rl' }}
      >
        <span className="flex items-center gap-1.5 font-display text-[12px] font-bold tracking-widest">
          <CalcIcon className="h-4 w-4" strokeWidth={2.2} />
          Kalkulator
        </span>
      </button>

      {/* Calculator card */}
      <div
        className={`fixed left-0 top-1/2 z-40 -translate-y-1/2 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="ml-2 w-[280px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalcIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" strokeWidth={2.2} />
              <span className="font-display text-[14px] font-extrabold text-slate-900 dark:text-white">
                Kalkulator
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Tutup kalkulator"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>

          {/* Screen / Display with Formula Expression */}
          <div className="mt-3 flex min-h-[66px] flex-col justify-between overflow-hidden rounded-xl bg-slate-50 px-3.5 py-2.5 text-right dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50">
            <div className="min-h-[16px] font-mono text-[12px] font-semibold text-slate-400 dark:text-slate-400 truncate">
              {expression || '\u00A0'}
            </div>
            <div className="font-mono text-[24px] font-bold text-slate-900 dark:text-white truncate">
              {display}
            </div>
          </div>

          {/* Keypad */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            <button onClick={clear} className={`${btn} bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400`}>
              C
            </button>
            <button onClick={backspace} className={`${btn} bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300`}>
              ⌫
            </button>
            <button onClick={() => applyOp('÷')} className={`${btn} bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-900/25 dark:text-cyan-400 font-bold dark:hover:bg-cyan-900/40`}>
              ÷
            </button>
            <button onClick={() => applyOp('×')} className={`${btn} bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-900/25 dark:text-cyan-400 font-bold dark:hover:bg-cyan-900/40`}>
              ×
            </button>

            {['7', '8', '9'].map((d) => (
              <button key={d} onClick={() => input(d)} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200`}>
                {d}
              </button>
            ))}
            <button onClick={() => applyOp('-')} className={`${btn} bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-900/25 dark:text-cyan-400 font-bold dark:hover:bg-cyan-900/40`}>
              −
            </button>

            {['4', '5', '6'].map((d) => (
              <button key={d} onClick={() => input(d)} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200`}>
                {d}
              </button>
            ))}
            <button onClick={() => applyOp('+')} className={`${btn} bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-900/25 dark:text-cyan-400 font-bold dark:hover:bg-cyan-900/40`}>
              +
            </button>

            {['1', '2', '3'].map((d) => (
              <button key={d} onClick={() => input(d)} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200`}>
                {d}
              </button>
            ))}
            <button onClick={equals} className={`${btn} row-span-1 bg-cyan-600 text-white hover:bg-cyan-700 font-bold`}>
              =
            </button>

            <button onClick={() => input('0')} className={`${btn} col-span-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200`}>
              0
            </button>
            <button onClick={() => input('.')} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200`}>
              .
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
