import { useState } from 'react';
import { Star, PenLine, X, BadgeCheck } from 'lucide-react';
import Reveal from './Reveal';
import { useAuth } from '../context/AuthContext';

interface Review {
  id: string;
  initials: string;
  username: string;
  rating: number;
  date: string;
  text: string;
  size: 'large' | 'small';
}

const AVATAR_TONES = [
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-fuchsia-600',
  'from-amber-500 to-orange-600',
];

const INITIAL_REVIEWS: Review[] = [
  {
    id: 'r1',
    initials: 'AR',
    username: 'andini_r',
    rating: 5,
    date: '22 Sept 2026',
    text: 'Followers TikTok saya naik persis sesuai jumlah yang dipesan. Prosesnya cepat, tidak sampai 2 jam sudah mulai masuk. Pelayanan admin juga ramah banget saat saya konfirmasi pembayaran.',
    size: 'large',
  },
  {
    id: 'r2',
    initials: 'DP',
    username: 'dimaspratama',
    rating: 5,
    date: '18 Sept 2026',
    text: 'Sudah coba beberapa seller SMM, Boosteryuk yang paling transparan. Harga jelas di awal, ada estimasi waktu, dan status pesanan bisa dipantau real-time. Nggak ada drama sama sekali.',
    size: 'large',
  },
  {
    id: 'r3',
    initials: 'SN',
    username: 'sinta.nabila',
    rating: 4,
    date: '12 Sept 2026',
    text: 'Order views YouTube 5 ribu, datangnya stabil dan natural. Sempat refill juga karena turun sedikit, tapi proses klaim garansinya gampang.',
    size: 'small',
  },
  {
    id: 'r4',
    initials: 'FA',
    username: 'fajaradit',
    rating: 5,
    date: '5 Sept 2026',
    text: 'Akun jualan saya di Shopee naik engagement-nya setelah pakai layanan ini. Sangat direkomendasikan untuk yang baru mulai jualan online.',
    size: 'small',
  },
];

function Stars({
  value,
  interactive = false,
  onSelect,
}: {
  value: number;
  interactive?: boolean;
  onSelect?: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1" aria-label={`Rating ${value} dari 5 bintang`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const n = i + 1;
        const star = (
          <Star
            className={`h-3 w-3 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
          />
        );
        return interactive ? (
          <button
            key={n}
            type="button"
            aria-label={`Beri rating ${n} bintang`}
            onClick={() => onSelect?.(n)}
            className="transition-transform hover:scale-125 active:scale-95"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}

function ReviewCard({ review, tone, delay = 0 }: { review: Review; tone: string; delay?: number }) {
  const large = review.size === 'large';
  return (
    <Reveal delay={delay}>
      <article
        className={`flex h-full flex-col rounded-[22px] border border-slate-200 bg-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.25)] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-700/60 dark:bg-slate-800/80 ${large ? 'p-6 sm:p-7' : 'p-5'}`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${tone} font-display font-extrabold text-white ${large ? 'h-12 w-12 text-[15px]' : 'h-10 w-10 text-[13px]'}`}
          >
            {review.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className={`truncate font-display font-extrabold tracking-tight text-slate-900 dark:text-white ${large ? 'text-[15px]' : 'text-[13.5px]'}`}>
                @{review.username}
              </p>
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" strokeWidth={2.4} />
            </div>
            <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {review.date}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <Stars value={review.rating} />
        </div>

        <p className={`mt-2.5 leading-relaxed text-slate-600 dark:text-slate-400 ${large ? 'text-[14px]' : 'text-[13px]'}`}>
          &ldquo;{review.text}&rdquo;
        </p>
      </article>
    </Reveal>
  );
}

function WriteReviewModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (text: string, rating: number) => void;
}) {
  const [text, setText] = useState('');
  const [rating, setRating] = useState(5);
  const [error, setError] = useState('');

  const submit = () => {
    if (!text.trim()) {
      setError('Tulis ulasan Anda terlebih dahulu.');
      return;
    }
    if (text.trim().length < 10) {
      setError('Ulasan minimal 10 karakter agar jelas.');
      return;
    }
    onSubmit(text.trim(), rating);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        aria-label="Tutup modal ulasan"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-900/55 backdrop-blur-[3px]"
      />
      <div className="relative w-full max-w-[440px] animate-modal-pop-in rounded-[26px] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/30 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-[18px] font-extrabold tracking-tight text-slate-900 dark:text-white">
              Buat Ulasan
            </h3>
            <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">
              Ceritakan pengalaman Anda menggunakan Boosteryuk.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Rating (1–5)
          </p>
          <Stars value={rating} interactive onSelect={setRating} />
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Ulasan Anda
          </span>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
            rows={4}
            placeholder="Bagaimana pengalaman Anda dengan layanan kami?"
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[13.5px] leading-relaxed text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
          />
        </label>

        {error && (
          <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
            {error}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            onClick={submit}
            className="h-11 rounded-xl bg-cyan-600 text-[13px] font-bold text-white shadow-md shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-[0.98]"
          >
            Submit Ulasan
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReviewsSection() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState(INITIAL_REVIEWS);
  const [showModal, setShowModal] = useState(false);
  const [showLoginAlert, setShowLoginAlert] = useState(false);

  const top = reviews.filter((review, index) => review.size === 'large' && index < 2);
  const bottom = reviews.filter((review) => review.size === 'small');

  const addReview = (text: string, rating: number) => {
    if (!user) return;
    const initials = user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
    const next: Review = {
      id: `user-${Date.now()}`,
      initials,
      username: user.username,
      rating,
      date: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
      text,
      size: 'small',
    };
    setReviews((current) => [...current, next]);
    setShowModal(false);
  };

  return (
    <section className="mt-6" aria-label="Ulasan pengguna">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
              Kenapa Boosteryuk
            </span>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[38px]">
              Apa kata mereka.
            </h2>
          </div>
          <p className="max-w-sm text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
            Ulasan dari pengguna yang sudah merasakan layanan booster kami.
          </p>
        </div>
      </Reveal>

      {/* First pair of wider user reviews */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {top.map((review, index) => (
          <ReviewCard
            key={review.id}
            review={review}
            tone={AVATAR_TONES[index % AVATAR_TONES.length]}
            delay={index * 80}
          />
        ))}
      </div>

      {/* Second pair and new user reviews */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {bottom.map((review, index) => (
          <ReviewCard
            key={review.id}
            review={review}
            tone={AVATAR_TONES[(index + 2) % AVATAR_TONES.length]}
            delay={120 + index * 80}
          />
        ))}
      </div>

      {/* Small pencil action sits below the final review, aligned to the right */}
      <Reveal delay={180}>
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => {
              if (!user) {
                setShowLoginAlert(true);
                window.setTimeout(() => setShowLoginAlert(false), 3200);
                return;
              }
              setShowModal(true);
            }}
            aria-label="Buat ulasan baru"
            title={user ? 'Buat ulasan' : 'Login untuk mengulas'}
            className="group flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[12px] font-bold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:text-cyan-700 hover:shadow-md active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-400"
          >
            <PenLine className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-rotate-6" strokeWidth={2.2} />
            Tulis ulasan
          </button>
        </div>
      </Reveal>

      {/* Inline login-required alert banner */}
      {showLoginAlert && (
        <div
          role="alert"
          className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 animate-fade-in rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-[12.5px] font-bold text-amber-800 shadow-xl dark:border-amber-800/50 dark:bg-amber-950 dark:text-amber-300"
        >
          Gagal: harus login terlebih dahulu untuk membuat ulasan.
        </div>
      )}

      {showModal && user && (
        <WriteReviewModal onClose={() => setShowModal(false)} onSubmit={addReview} />
      )}
    </section>
  );
}