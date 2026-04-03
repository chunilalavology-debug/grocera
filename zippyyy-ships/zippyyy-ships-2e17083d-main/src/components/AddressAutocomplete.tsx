import { Autocomplete, GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export type TaggedAddress = {
  formattedAddress: string;
  placeId: string;
  lat: number;
  lng: number;
  components: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode: string;
    countryAlpha2: string;
  };
};

const libraries = ["places"] as const;

export function AddressAutocomplete(props: {
  label: string;
  value: TaggedAddress | null;
  onChange: (value: TaggedAddress | null) => void;
  placeholder?: string;
  active?: boolean;
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const enabled = Boolean(apiKey);
  const active = props.active ?? true;

  const { isLoaded } = useJsApiLoader({
    id: "zippyyy-maps",
    googleMapsApiKey: apiKey ?? "",
    libraries: [...libraries],
    preventGoogleFontsLoading: true,
  });

  const [input, setInput] = useState(props.value?.formattedAddress ?? "");
  const [manual, setManual] = useState(() => ({
    addressLine1: props.value?.components.addressLine1 ?? "",
    addressLine2: props.value?.components.addressLine2 ?? "",
    city: props.value?.components.city ?? "",
    state: props.value?.components.state ?? "",
    postalCode: props.value?.components.postalCode ?? "",
    countryAlpha2: props.value?.components.countryAlpha2 ?? "US",
  }));
  const manualCommitTimerRef = useRef<number | null>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);

  const center = useMemo(() => {
    if (props.value) return { lat: props.value.lat, lng: props.value.lng };
    return { lat: 40.7128, lng: -74.006 }; // default NYC
  }, [props.value]);

  const onPlaceChanged = () => {
    const ac = acRef.current;
    const place = ac?.getPlace();
    if (!place || !place.geometry?.location || !place.place_id) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const formattedAddress = place.formatted_address ?? input;

    const components = extractComponents(place.address_components ?? []);
    const tagged: TaggedAddress = {
      formattedAddress,
      placeId: place.place_id,
      lat,
      lng,
      components,
    };

    setInput(formattedAddress);
    props.onChange(tagged);
  };

  const emitManual = (next = manual) => {
    const formattedAddress = [
      next.addressLine1,
      next.addressLine2,
      next.city,
      next.state,
      next.postalCode,
      next.countryAlpha2,
    ]
      .filter(Boolean)
      .join(", ");

    setInput(formattedAddress);

    // Debounce commits so typing doesn't re-render the entire quote UI on every keystroke.
    if (manualCommitTimerRef.current) window.clearTimeout(manualCommitTimerRef.current);
    manualCommitTimerRef.current = window.setTimeout(() => {
      if (!next.addressLine1 || !next.city || !next.postalCode || !next.countryAlpha2) {
        props.onChange(null);
        return;
      }

      props.onChange({
        formattedAddress,
        placeId: "manual",
        lat: 0,
        lng: 0,
        components: {
          addressLine1: next.addressLine1,
          addressLine2: next.addressLine2 || undefined,
          city: next.city,
          state: next.state || undefined,
          postalCode: next.postalCode,
          countryAlpha2: next.countryAlpha2.toUpperCase(),
        },
      });
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (manualCommitTimerRef.current) window.clearTimeout(manualCommitTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 block">
          {props.label}
        </label>
        {enabled && active && isLoaded ? (
          <Autocomplete
            onLoad={(ac) => (acRef.current = ac)}
            onPlaceChanged={onPlaceChanged}
            options={{ fields: ["place_id", "formatted_address", "geometry", "address_components"] }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={props.placeholder ?? "Start typing an address"}
              className="h-12 rounded-2xl bg-secondary border-none focus-visible:ring-primary/50"
            />
          </Autocomplete>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {enabled ? "Loading Google Maps…" : "Google Maps is not enabled yet — enter the address manually."}
            </div>
            <Input
              value={manual.addressLine1}
              onChange={(e) => {
                const next = { ...manual, addressLine1: e.target.value };
                setManual(next);
                emitManual(next);
              }}
              placeholder="Address line 1"
              className="h-12 rounded-2xl bg-secondary border-none focus-visible:ring-primary/50"
            />
            <Input
              value={manual.addressLine2}
              onChange={(e) => {
                const next = { ...manual, addressLine2: e.target.value };
                setManual(next);
                emitManual(next);
              }}
              placeholder="Address line 2 (optional)"
              className="h-12 rounded-2xl bg-secondary border-none focus-visible:ring-primary/50"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={manual.city}
                onChange={(e) => {
                  const next = { ...manual, city: e.target.value };
                  setManual(next);
                  emitManual(next);
                }}
                placeholder="City"
                className="h-12 rounded-2xl bg-secondary border-none focus-visible:ring-primary/50"
              />
              <Input
                value={manual.state}
                onChange={(e) => {
                  const next = { ...manual, state: e.target.value };
                  setManual(next);
                  emitManual(next);
                }}
                placeholder="State/Province"
                className="h-12 rounded-2xl bg-secondary border-none focus-visible:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={manual.postalCode}
                onChange={(e) => {
                  const next = { ...manual, postalCode: e.target.value };
                  setManual(next);
                  emitManual(next);
                }}
                placeholder="Postal code"
                className="h-12 rounded-2xl bg-secondary border-none focus-visible:ring-primary/50 font-mono"
              />
              <Input
                value={manual.countryAlpha2}
                onChange={(e) => {
                  const next = { ...manual, countryAlpha2: e.target.value };
                  setManual(next);
                  emitManual(next);
                }}
                placeholder="Country (2-letter, e.g. US)"
                className="h-12 rounded-2xl bg-secondary border-none focus-visible:ring-primary/50 font-mono uppercase"
              />
            </div>
          </div>
        )}
      </div>

      {enabled && active && isLoaded && props.value && (
        <div className="rounded-2xl overflow-hidden border border-border/40">
          <GoogleMap
            center={center}
            zoom={14}
            mapContainerStyle={{ height: 180, width: "100%" }}
            options={{
              disableDefaultUI: true,
              gestureHandling: "cooperative",
              zoomControl: true,
            }}
          >
            <Marker position={center} />
          </GoogleMap>
        </div>
      )}
    </div>
  );
}

function extractComponents(components: google.maps.GeocoderAddressComponent[]): TaggedAddress["components"] {
  const byType = new Map<string, google.maps.GeocoderAddressComponent>();
  for (const c of components) for (const t of c.types) byType.set(t, c);

  const streetNumber = byType.get("street_number")?.long_name ?? "";
  const route = byType.get("route")?.long_name ?? "";
  const addressLine1 = [streetNumber, route].filter(Boolean).join(" ").trim();

  const city =
    byType.get("locality")?.long_name ??
    byType.get("postal_town")?.long_name ??
    byType.get("administrative_area_level_2")?.long_name ??
    "";

  const state = byType.get("administrative_area_level_1")?.short_name ?? "";
  const postalCode = byType.get("postal_code")?.long_name ?? "";
  const countryAlpha2 = byType.get("country")?.short_name ?? "";

  return {
    addressLine1: addressLine1 || "",
    city,
    state: state || undefined,
    postalCode,
    countryAlpha2,
  };
}

