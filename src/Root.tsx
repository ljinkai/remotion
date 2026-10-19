import { Composition, type CalculateMetadataFunction } from "remotion";
import "./index.css";
import { MyComposition } from "./Composition";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./host-explainer/demoScript";
import { HostExplainerDemo } from "./host-explainer/HostExplainer";
import { HostExplainer } from "./host-explainer/HostFromBeats";
import {
  HOST_FPS,
  hostDurationInFrames,
  sampleHostProps,
  type HostExplainerProps,
} from "./host-explainer/hostTypes";

const hostMetadata: CalculateMetadataFunction<HostExplainerProps> = ({
  props,
}) => ({
  durationInFrames: hostDurationInFrames(props.beats),
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition
        id="HostExplainerDemo"
        component={HostExplainerDemo}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="HostExplainer"
        component={HostExplainer}
        durationInFrames={hostDurationInFrames(sampleHostProps.beats)}
        fps={HOST_FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={sampleHostProps}
        calculateMetadata={hostMetadata}
      />
    </>
  );
};
