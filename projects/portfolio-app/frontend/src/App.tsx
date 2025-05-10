import viteLogo from "/vite.svg";
import reactLogo from "./assets/react.svg";
import "./App.css";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

const queryClient = new QueryClient();

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Example />
        </QueryClientProvider>
    );
}

interface Datum {
    message: number;
}

const Example = () => {
    const { data } = useQuery({
        queryKey: ["data"],
        queryFn: () => {
            fetch("/api/healthcheck").then((res) => res.json());
        },
    });
    const datata = data as unknown as Datum;
    return (
        <>
            <div>
                <a href="https://vite.dev" target="_blank" rel="noreferrer">
                    <img src={viteLogo} className="logo" alt="Vite logo" />
                </a>
                <a href="https://react.dev" target="_blank" rel="noreferrer">
                    <img src={reactLogo} className="logo react" alt="React logo" />
                </a>
            </div>
            <div>{datata ? datata.message : "sdads"}</div>
            <div className="card">
                {/* <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button> */}
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
        </>
    );
};

export default App;
