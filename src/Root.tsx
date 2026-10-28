import { Composition, type CalculateMetadataFunction } from "remotion";
import "./index.css";
import { KnowledgeExplainer, type KnowledgeVideoProps } from "./knowledge/KnowledgeExplainer";
import { knowledgeDuration } from "./knowledge/knowledgeLayout";
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

const knowledgeMetadata: CalculateMetadataFunction<KnowledgeVideoProps> = ({ props }) => ({
  durationInFrames: knowledgeDuration(props.beats), width: 1920, height: 1080,
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="KnowledgeExplainer"
        component={KnowledgeExplainer}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ contentMode: "knowledge", templateId: "knowledge", aspect: "landscape", locale: "zh", beats: [], knowledge: { title: "知识讲解", chapters: [] } } satisfies KnowledgeVideoProps}
        calculateMetadata={knowledgeMetadata}
      />
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
