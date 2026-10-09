import { useState } from "react";

export function Child() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}

export function Parent() {
  return (
    <main>
      <h1>Vite Dev Source Map Example</h1>
      <p>Select Child in React DevTools, then click Parent under Rendered by.</p>
      <Child />
    </main>
  );
}
