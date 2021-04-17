import { Agent } from "../../src";

export const createAgent = async (): Promise<Agent> => {
  const agent = new Agent({
    domain: 'dec112.eu',
    endpoint: 'ws://dec112.at',
    password: 'password',
    user: 'user',
  });

  try {
    // as agent initialization will always fail due to a missing backend
    // we just bypass the initialization process with an already resolved promise
    await Promise.race([
      Promise.resolve(),
      agent.initialize(),
    ]);
  }
  catch {
    /* In this example awaiting the agent's initialization will always lead to an error because there is no real backend available */
  }

  return agent;
}

export const endExample = () => {
  // jest expects at least one `expect` per test file
  expect(true).toBe(true);
}