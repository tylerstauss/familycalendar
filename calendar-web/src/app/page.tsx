import Link from "next/link";

const features = [
  {
    icon: "📅",
    title: "Family Calendar",
    description: "One shared calendar for everyone. Day, week, and month views with color-coded family members.",
  },
  {
    icon: "🍽️",
    title: "Meal Planning",
    description: "Plan weekly meals, save recipes, and auto-generate grocery lists so dinner is never a question.",
  },
  {
    icon: "✅",
    title: "Chores & Rewards",
    description: "Assign chores, track completions, earn stars, and redeem rewards. Kids actually want to help.",
  },
  {
    icon: "🚗",
    title: "Rides Coordinator",
    description: "Plan pickups and drop-offs for kids' activities. See drive times and assign drivers at a glance.",
  },
  {
    icon: "📋",
    title: "Grocery Lists",
    description: "Shared lists that sync in real time. Check items off as you shop — no more double-buying.",
  },
  {
    icon: "📸",
    title: "Family Photos",
    description: "A private photo slideshow for your family. Display it on a wall-mounted iPad as a living frame.",
  },
];

const steps = [
  { step: "1", title: "Create your family", description: "Sign up and name your family. Takes 30 seconds." },
  { step: "2", title: "Add family members", description: "Add everyone in your household with their own color." },
  { step: "3", title: "Connect calendars", description: "Paste Google Calendar links to pull in existing events." },
  { step: "4", title: "Put it on the wall", description: "Mount an iPad and set it to kiosk mode. Your dashboard is live." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">Family Calendar</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors">
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-600 transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            14-day free trial — no credit card required
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
            The command center<br />for your family
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            One place for your family&apos;s calendar, meals, chores, rides, and more.
            Designed to live on a wall-mounted iPad — always on, always up to date.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-indigo-500 text-white font-semibold rounded-xl hover:bg-indigo-600 transition-colors text-base"
            >
              Start your free trial
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-base"
            >
              Log in
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-4">$4.99/month after trial · cancel anytime</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything your family needs</h2>
            <p className="text-gray-500 text-lg">All features included in every plan.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Up and running in minutes</h2>
            <p className="text-gray-500 text-lg">No IT degree required.</p>
          </div>
          <div className="space-y-6">
            {steps.map((s) => (
              <div key={s.step} className="flex items-start gap-5">
                <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {s.step}
                </div>
                <div className="pt-1.5">
                  <p className="font-semibold text-gray-900">{s.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Simple pricing</h2>
          <p className="text-gray-500 text-lg">One family. One price. All features.</p>
        </div>
        <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Monthly */}
          <div className="bg-white rounded-2xl border border-gray-200 p-7 flex flex-col">
            <h3 className="font-semibold text-gray-900 mb-2">Monthly</h3>
            <div className="mb-4">
              <span className="text-4xl font-bold text-gray-900">$4.99</span>
              <span className="text-gray-400 text-sm">/month</span>
            </div>
            <p className="text-sm text-gray-500 mb-6 flex-1">Full access. Cancel anytime.</p>
            <Link
              href="/register"
              className="block text-center py-2.5 px-4 bg-indigo-500 text-white rounded-xl font-medium text-sm hover:bg-indigo-600 transition-colors"
            >
              Start free trial
            </Link>
          </div>
          {/* Annual */}
          <div className="bg-indigo-500 rounded-2xl p-7 flex flex-col relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-semibold px-3 py-1 rounded-full">
              BEST VALUE
            </span>
            <h3 className="font-semibold text-white mb-2">Annual</h3>
            <div className="mb-1">
              <span className="text-4xl font-bold text-white">$49.99</span>
              <span className="text-indigo-200 text-sm">/year</span>
            </div>
            <p className="text-sm text-indigo-200 font-medium mb-4">Save ~17%</p>
            <p className="text-sm text-indigo-100 mb-6 flex-1">Full access for a full year.</p>
            <Link
              href="/register"
              className="block text-center py-2.5 px-4 bg-white text-indigo-600 rounded-xl font-medium text-sm hover:bg-indigo-50 transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
        <p className="text-center text-sm text-gray-400 mt-6">14-day free trial on all plans · no credit card required to start</p>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Ready to get organized?</h2>
          <p className="text-gray-500 text-lg mb-8">
            Join families who&apos;ve replaced the fridge whiteboard with something that actually works.
          </p>
          <Link
            href="/register"
            className="inline-block px-10 py-4 bg-indigo-500 text-white font-semibold rounded-xl hover:bg-indigo-600 transition-colors text-lg"
          >
            Start your 14-day free trial
          </Link>
          <p className="text-sm text-gray-400 mt-4">No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-indigo-500 rounded-md flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <span className="text-sm text-gray-500">Family Calendar</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-gray-400">
            <Link href="/login" className="hover:text-gray-600 transition-colors">Log in</Link>
            <Link href="/register" className="hover:text-gray-600 transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
