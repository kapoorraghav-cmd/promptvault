import { Library, Plus, SearchX, Star } from 'lucide-react'
import { ActiveFilters, CreationsGrid, LibraryToolbar, useFilteredCreations, useLibraryFilters } from '../components/creations/library-view'
import { Button, ButtonLink } from '../components/ui/button'
import { EmptyState, PageHeader } from '../components/ui/misc'

export function LibraryPage() {
  const { filters, view, set } = useLibraryFilters()
  const { all, results } = useFilteredCreations(filters)

  const hasFilters =
    Boolean(filters.query || filters.tag || filters.model || filters.collectionId) || filters.favouritesOnly || filters.types.length > 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <PageHeader
        title={filters.favouritesOnly && !filters.query ? 'Favourites' : 'Library'}
        description={
          filters.favouritesOnly && !filters.query
            ? 'Your best prompts and results, all in one place.'
            : 'Everything you’ve saved. Search, filter and reuse.'
        }
        actions={
          <ButtonLink to="/new" variant="primary" icon={<Plus />} className="max-sm:hidden">
            New creation
          </ButtonLink>
        }
      />

      {all && all.length > 0 && <LibraryToolbar filters={filters} view={view} set={set} creations={all} />}
      {all && all.length > 0 && <ActiveFilters filters={filters} set={set} count={results?.length ?? 0} />}

      {all === undefined ? null : all.length === 0 ? (
        <EmptyState
          icon={<Library />}
          title="Your library is empty"
          description="Save your first prompt — paste the text, attach the image it produced and note which model you used."
          action={
            <>
              <ButtonLink to="/new" variant="primary" icon={<Plus />}>
                Add your first creation
              </ButtonLink>
              <ButtonLink to="/settings#sample-data" variant="outline">
                Load sample library
              </ButtonLink>
            </>
          }
        />
      ) : results && results.length === 0 ? (
        <EmptyState
          icon={filters.favouritesOnly && !filters.query ? <Star /> : <SearchX />}
          title={filters.favouritesOnly && !filters.query ? 'No favourites yet' : 'Nothing matches'}
          description={
            filters.favouritesOnly && !filters.query
              ? 'Tap the star on any creation to keep it here.'
              : 'Try a different word, or remove some filters.'
          }
          action={
            hasFilters && (
              <Button variant="outline" onClick={() => set({ q: null, tag: null, model: null, fav: null, type: null, collection: null })}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        results && <CreationsGrid creations={results} view={view} />
      )}
    </div>
  )
}
