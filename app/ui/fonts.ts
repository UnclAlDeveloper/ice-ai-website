import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { Akaya_Kanadaka, Amiri } from 'next/font/google';

// AKAYA KANADAKA
export const akayaKanadaka = Akaya_Kanadaka({
    weight: '400', // Akaya Kanadaka only supports 400 weight
    subsets: ['latin'],
    display: 'swap', // Matches your desired font display property
});
/* Google font configuration for Akaya Kanadaka, used for decorative text elements. */

// AMIRI QURAN
export const amiriQuran = Amiri({
    weight: ['400', '700'], // Adjust weights based on usage
    subsets: ['latin'], // Include subsets for better support
    display: 'swap',
});
/* Google font configuration for Amiri Quran, used for Arabic-style text elements. */
