// frontend/src/pages/HelpCenter.jsx

const SUPPORT_EMAIL = 'fidarimex.connect@gmail.com';
const SUPPORT_PHONE_DISPLAY = '8104467189';
const SUPPORT_PHONE_LINK = '+918104467189';
const WHATSAPP_LINK = 'https://wa.me/918104467189';

const supportOptions = [
  {
    title: 'Email Support',
    detail: SUPPORT_EMAIL,
    description: 'Send us an email for account, portal, QR, document, or technical support.',
    href: `mailto:${SUPPORT_EMAIL}`,
    action: 'Send Email',
  },
  {
    title: 'Call Support',
    detail: SUPPORT_PHONE_DISPLAY,
    description: 'Call our support number directly from your phone.',
    href: `tel:${SUPPORT_PHONE_LINK}`,
    action: 'Call Now',
  },
  {
    title: 'WhatsApp Support',
    detail: SUPPORT_PHONE_DISPLAY,
    description: 'Start a WhatsApp conversation with the support team.',
    href: WHATSAPP_LINK,
    action: 'Open WhatsApp',
    external: true,
  },
];

export default function HelpCenter() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-orange-600">
          Support
        </p>

        <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
          Help Center
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          Need help with your portal, account, QR operations, identity documents, or scanners? Contact the Fidar Imex support team using any option below.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {supportOptions.map((option) => (
          <article
            key={option.title}
            className="flex min-h-56 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <h3 className="text-lg font-extrabold text-slate-900">
              {option.title}
            </h3>

            <p className="mt-2 break-words text-sm font-bold text-orange-600">
              {option.detail}
            </p>

            <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">
              {option.description}
            </p>

            <a
              href={option.href}
              target={option.external ? '_blank' : undefined}
              rel={option.external ? 'noreferrer' : undefined}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-extrabold text-white transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              {option.action}
            </a>
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 text-sm leading-6 text-slate-700">
        When contacting support, include your role and a short description of the issue. Do not send passwords, OTPs, encryption keys, API secrets, PAN numbers, or Aadhaar numbers through email, phone, or WhatsApp.
      </div>
    </section>
  );
}
