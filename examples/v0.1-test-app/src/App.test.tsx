import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("로그인 기준 기능", () => {
  it("초기 로그인 버튼 문구와 배경색을 표시한다", () => {
    render(<App />);

    const loginButton = screen.getByRole("button", { name: "로그인" });

    expect(loginButton).toBeInTheDocument();
    expect(loginButton).toHaveStyle({ backgroundColor: "#374151" });
  });

  it("로그인 버튼을 누르면 로그인 요청 문구를 표시한다", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(screen.getByText("로그인 요청이 실행되었습니다.")).toBeInTheDocument();
  });
});

describe("검색 기준 기능", () => {
  it("빈 검색어에서도 검색 요청을 실행한다", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "검색" }));

    expect(screen.getByText("검색 요청 실행: 1회")).toBeInTheDocument();
  });

  it("한 글자 이상 입력했을 때 검색 요청을 실행한다", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("검색어"), {
      target: { value: "코드" },
    });
    fireEvent.click(screen.getByRole("button", { name: "검색" }));

    expect(screen.getByText("검색 요청 실행: 1회")).toBeInTheDocument();
  });

  it("검색 요청을 반복하면 실행 횟수가 증가한다", () => {
    render(<App />);

    const searchButton = screen.getByRole("button", { name: "검색" });
    fireEvent.click(searchButton);
    fireEvent.click(searchButton);

    expect(screen.getByText("검색 요청 실행: 2회")).toBeInTheDocument();
  });
});
