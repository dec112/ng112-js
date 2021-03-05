import type { SimpleLocation, LocationMethod } from 'pidf-lo';

/**
 * @deprecated
 */
export const generatePidf = (
  sipUri: string,
  location: SimpleLocation
) => `<?xml version="1.0" encoding="UTF-8"?>
<presence xmlns="urn:ietf:params:xml:ns:pidf"
  xmlns:gp="urn:ietf:params:xml:ns:pidf:geopriv10"
  xmlns:gbp="urn:ietf:params:xml:ns:pidf:geopriv10:basicPolicy"
  xmlns:gml="http://www.opengis.net/gml"
  xmlns:dm="urn:ietf:params:xml:ns:pidf:data-model" 
  entity="${sipUri}">
  <dm:tuple id="ue">
    <status>
      <gp:geopriv>
        <gp:location-info>
          <gml:Circle srsName="urn:ogc:def:crs:EPSG::4326">
            <gml:pos>${location.latitude} ${location.longitude}</gml:pos>
            <gs:radius>
              ${location.radius}
            </gs:radius>
          </gml:Circle>
        </gp:location-info>
        <gp:usage-rules>
          <gbp:retransmission-allowed>no</gbp:retransmission-allowed>
        </gp:usage-rules>
        <gp:method>${location.method}</gp:method>
      </gp:geopriv>
    </status>
  </dm:tuple>
</presence>`;

/**
 * @deprecated
 */
export const parsePidf = (
  pidf: string,
): SimpleLocation | undefined => {
  const latlng = /<gml:pos>([\w\d\.]+)\s+([w\d\.]+)<\/gml:pos>/.exec(pidf);
  const method = /<gp:method>([\w\d\.]+)<\/gp:method>/.exec(pidf);

  if (!(latlng && method))
    return;

  return {
    latitude: parseFloat(latlng[1]),
    longitude: parseFloat(latlng[2]),
    method: method[1] as LocationMethod,
  };
}