import Link from 'next/link';

const MobileHeader = () => {
  return (
    <header className='md:hidden w-full bg-white/70 backdrop-blur-xl border-b border-gray-200/50 shadow-sm'>
      <div className='h-12 flex items-center justify-center'>
        <Link
          href='/'
          className='text-2xl font-bold text-green-600 tracking-tight hover:opacity-80 transition-opacity'
        >
          WarHutTV
        </Link>
      </div>
    </header>
  );
};

export default MobileHeader;
