export function Card() {
    return (
        <article data-oid="card-1" className="rounded-lg border bg-card p-4">
            <h2 data-oid="title-1" className="text-lg font-semibold">
                Dune
            </h2>
            <p data-oid="body-1" className={true ? 'text-sm' : 'text-xs'}>
                A desert planet.
            </p>
        </article>
    );
}
