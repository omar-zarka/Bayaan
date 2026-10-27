// @ai-generated
import React from 'react';
import TranslationsContent from '@/components/screens/TranslationsContent';
import {MaxWidthContainer} from '@/components/layout/MaxWidthContainer';

/**
 * Translations and tafaseer picker opened from the reader and the verse
 * sheet. It lives in the root stack so it opens on top of the Mushaf (or
 * whatever screen is showing) and Back returns there, instead of switching
 * to a tab. Settings keeps its own copy at (d.settings)/translations.
 */
export default function TranslationsScreen() {
  return (
    <MaxWidthContainer>
      <TranslationsContent />
    </MaxWidthContainer>
  );
}
