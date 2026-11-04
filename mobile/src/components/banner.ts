import { createContext, useContext } from 'react';

/** True inside the forest page banner, where buttons switch to the amber and outline styles. */
export const BannerContext = createContext(false);
export const useOnBanner = () => useContext(BannerContext);
