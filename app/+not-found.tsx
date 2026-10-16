import {useEffect} from 'react';
import {useNavigationContainerRef} from 'expo-router';

// An unknown link (an old widget, a typo) leaves this route and shows the
// screen underneath. Redirecting to "/" instead would stack a second copy of
// the tabs with nothing to go back to.
export default function NotFound(): null {
  const navigation = useNavigationContainerRef();
  useEffect(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.dispatch({type: 'REPLACE', payload: {name: '(tabs)'}});
  }, [navigation]);
  return null;
}
