type LoginViewProps = {
  environmentLabel: string; title: string; description: string; footnote: string;
  error: string | undefined; configured: boolean; loginWithGoogle: () => Promise<void>;
};

export default function AdminLoginView({ environmentLabel, title, description, footnote, error, configured, loginWithGoogle }: LoginViewProps) {
  return (
    <main id="main-content" className="min-h-screen bg-navy-900 px-5 py-16 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center">
        <section className="glass-card w-full p-7 md:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#e0c985]">{environmentLabel}</p>
          <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
          <p className="mt-3 text-base leading-7 text-white/70">
            {description}
          </p>

          {error ? (
            <div role="alert" className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm leading-6 text-red-100">
              เข้าสู่ระบบไม่สำเร็จ บัญชีนี้อาจยังไม่ได้รับสิทธิ์ กรุณาติดต่อผู้ดูแลให้เพิ่มอีเมลของคุณในรายชื่อผู้ใช้
            </div>
          ) : null}

          {configured ? (
            <form action={loginWithGoogle} className="mt-8">
              <button
                type="submit"
                className="gold-button w-full px-5 py-3.5 text-sm"
              >
                เข้าสู่ระบบด้วย Google
              </button>
            </form>
          ) : (
            <div className="mt-8 rounded-2xl border border-amber-200/20 bg-amber-200/10 px-4 py-4 text-sm leading-6 text-amber-50">
              ระบบเข้าสู่ระบบของพื้นที่ควบคุมยังตั้งค่าไม่ครบ จึงปิดการเข้าใช้งานไว้เพื่อความปลอดภัย กรุณาให้ผู้ดูแลตั้งค่า Google Login และรายชื่อผู้ใช้ก่อน
            </div>
          )}

          <p className="mt-6 text-sm leading-6 text-white/60">
            {footnote}
          </p>
        </section>
      </div>
    </main>
  );
}
