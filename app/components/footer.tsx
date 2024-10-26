export function Footer() {
  return (
    <div className="text-center py-12">
      <p className="text-s text-gray-400 max-w-3xl mx-auto">
        <a rel="noopener" href="mailto:hello@sendas.email" target="_blank">
          Contact
        </a>{" "}
        |{" "}
        <a
          rel="noopener"
          href="https://learn.microsoft.com/en-us/graph/api/user-sendmail"
          target="_blank"
        >
          Reference
        </a>{" "}
        |{" "}
        <a rel="noopener" href="https://github.com/jasperchan" target="_blank">
          Github
        </a>
      </p>
    </div>
  );
}
