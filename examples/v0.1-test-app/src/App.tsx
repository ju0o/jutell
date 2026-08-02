import { useState, type FormEvent } from "react";

function LoginPanel() {
  const [message, setMessage] = useState("");

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("로그인 요청이 실행되었습니다.");
  }

  return (
    <section aria-labelledby="login-title" className="panel">
      <h2 id="login-title">로그인</h2>
      <form onSubmit={handleLogin}>
        <label htmlFor="email">이메일</label>
        <input id="email" name="email" type="email" />

        <label htmlFor="password">비밀번호</label>
        <input id="password" name="password" type="password" />

        <button type="submit" style={{ backgroundColor: "#2563EB" }}>
          로그인하기
        </button>
      </form>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}

function SearchPanel() {
  const [query, setQuery] = useState("");
  const [requestCount, setRequestCount] = useState(0);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestCount((currentCount) => currentCount + 1);
  }

  return (
    <section aria-labelledby="search-title" className="panel">
      <h2 id="search-title">검색</h2>
      <form onSubmit={handleSearch}>
        <label htmlFor="search-query">검색어</label>
        <input
          id="search-query"
          name="search-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit">검색</button>
      </form>
      <p role="status">검색 요청 실행: {requestCount}회</p>
    </section>
  );
}

export default function App() {
  return (
    <main>
      <h1>Codex Beginner Bridge V0.1 테스트 앱</h1>
      <LoginPanel />
      <SearchPanel />
    </main>
  );
}
