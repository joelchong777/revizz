import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy · Revizz',
  description: 'What Revizz collects, why, who can see it, and the choices you have.',
};

const sectionHeading = 'font-heading text-xl font-black text-[#201e1d] mb-2';
const para = 'text-base leading-7 text-[#201e1d]';
const list = 'list-disc pl-5 space-y-1.5 text-base leading-7 text-[#201e1d]';

export default function PrivacyPage() {
  return (
    <div className="w-full max-w-[680px] mx-auto px-4 py-6 flex flex-col gap-5">
      <Link
        href="/"
        className="self-start text-sm font-bold text-[#201e1d] underline underline-offset-2 hover:text-accent-700"
      >
        ← Back to Revizz
      </Link>

      <article className="bg-neutral-100 border-4 border-text shadow-offset-6 rounded-3xl p-5 sm:p-8 flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-black text-[#201e1d]">Privacy Policy</h1>
          <p className="inline-block self-start text-xs font-bold text-[#201e1d] bg-accent-200 border-2 border-text rounded-full px-3 py-1">
            Draft · last updated 24 October 2026
          </p>
          <p className={para}>
            This page explains in plain words what Revizz keeps about you and why. Revizz is for students aged 13 and over.
          </p>
        </header>

        <section>
          <h2 className={sectionHeading}>What we collect</h2>
          <ul className={list}>
            <li>Your email address and display name.</li>
            <li>Your password. Our sign-in provider stores it hashed, so we never see it.</li>
            <li>Your quiz answers and attempts.</li>
            <li>Your XP and streaks.</li>
            <li>Your review pile (questions you want to practise again).</li>
            <li>Basic usage events, such as quizzes started and finished and questions answered.</li>
          </ul>
        </section>

        <section>
          <h2 className={sectionHeading}>Why we collect it</h2>
          <p className={para}>
            To run the quizzes, keep track of your progress, and improve our questions.
          </p>
        </section>

        <section>
          <h2 className={sectionHeading}>Who can see it</h2>
          <p className={para}>
            You can see your own data. Your teachers and school admins on Revizz can also see your progress.
          </p>
        </section>

        <section>
          <h2 className={sectionHeading}>Where it is stored</h2>
          <p className={para}>
            Your data is stored with Supabase (our database and sign-in provider). The app is hosted on Vercel, with
            servers in Singapore.
          </p>
        </section>

        <section>
          <h2 className={sectionHeading}>We do not sell your data</h2>
          <p className={para}>
            We never sell your data and we do not build advertising profiles about you. We may show general ads that
            are not based on your data.
          </p>
        </section>

        <section>
          <h2 className={sectionHeading}>Storage on your device</h2>
          <p className={para}>
            Revizz keeps some of your progress in your browser&apos;s local storage so it works smoothly on your device.
            We do not use tracking cookies.
          </p>
        </section>

        <section>
          <h2 className={sectionHeading}>Your choices</h2>
          <ul className={list}>
            <li>You can change your password at any time.</li>
            <li>
              You can delete your account in Settings. This deletes your progress, XP, review pile and the account
              itself.
            </li>
            <li>You can also contact us with any question or request.</li>
          </ul>
        </section>

        <section>
          <h2 className={sectionHeading}>Age</h2>
          <p className={para}>Revizz is for students aged 13 and over.</p>
        </section>

        <section>
          <h2 className={sectionHeading}>Contact</h2>
          <p className={para}>
            Questions about this policy? Email us at <a href="mailto:joel.chong.777@gmail.com" className="font-bold underline">joel.chong.777@gmail.com</a>.
          </p>
        </section>

        <p className="text-sm text-[#645c50]">
          See also our{' '}
          <Link href="/terms" className="font-bold underline underline-offset-2 text-[#201e1d]">
            Terms of Use
          </Link>
          .
        </p>
      </article>
    </div>
  );
}
