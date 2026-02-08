'use client';

import dynamic from 'next/dynamic';

const RaksaApp = dynamic(() => import('../App'), { ssr: false });

export default function Home() {
  return <RaksaApp />;
}
